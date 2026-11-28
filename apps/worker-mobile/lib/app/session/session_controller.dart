import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../../api/worker_api.dart';
import '../worker_config.dart';
import 'session_store.dart';

enum SessionPhase {
  starting,
  signedOut,
  signingIn,
  checking,
  blocked,
  ready,
  expired,
  signingOut,
  storageBlocked,
}

enum SessionIssue {
  configuration,
  credentials,
  company,
  worker,
  warehouse,
  unavailable,
  unexpected,
  storage,
  serverSignOut,
}

class SessionController extends ChangeNotifier {
  SessionController({
    required this.config,
    required this._api,
    required this._store,
    this.idleLimit = const Duration(minutes: 15),
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final WorkerConfig config;
  final WorkerApi _api;
  final SessionStore _store;
  final Duration idleLimit;
  final DateTime Function() _clock;

  SessionPhase _phase = SessionPhase.starting;
  SessionIssue? _issue;
  Credentials? _credentials;
  Warehouse? _warehouse;
  DateTime? _lastActivity;
  DateTime? _lastSnapshot;
  Timer? _idleTimer;
  Future<Credentials>? _refreshing;
  bool _disposed = false;

  SessionPhase get phase => _phase;
  SessionIssue? get issue => _issue;
  Warehouse? get warehouse => _warehouse;

  Future<void> start() async {
    try {
      final stored = await _store.read();
      if (_disposed) return;
      if (stored == null) {
        _show(
          SessionPhase.signedOut,
          config.apiUri == null ? SessionIssue.configuration : null,
        );
        return;
      }

      if (stored.scope != config.sessionScope ||
          !_allowedWorker(stored.credentials)) {
        await _end(SessionPhase.signedOut);
        return;
      }
      _credentials = stored.credentials;
      _lastActivity = stored.lastActivity;
      if (_remainingIdle <= Duration.zero) {
        await _end(SessionPhase.expired, revoke: true);
        return;
      }
      _scheduleIdle();
      await _verifyWarehouse();
    } on PlatformException {
      _show(SessionPhase.storageBlocked, SessionIssue.storage);
    }
  }

  Future<void> signIn(String phone, String password) async {
    if (_phase != SessionPhase.signedOut) return;
    if (config.apiUri == null) {
      _show(SessionPhase.signedOut, SessionIssue.configuration);
      return;
    }

    _show(SessionPhase.signingIn);
    try {
      final credentials = await _api.signIn(
        phone: phone.trim(),
        password: password,
        deviceId: await _store.deviceId(),
        tenantId: config.tenantId,
      );
      if (_disposed) return;
      _credentials = credentials;
      if (!_allowedWorker(credentials)) {
        await _end(
          SessionPhase.signedOut,
          issue: SessionIssue.worker,
          revoke: true,
        );
        return;
      }
      _lastActivity = _clock();
      _scheduleIdle();
      await _verifyWarehouse();
    } on ApiFailure catch (failure) {
      _show(SessionPhase.signedOut, switch (failure) {
        ApiFailure(status: 401) => SessionIssue.credentials,
        ApiFailure(code: 'companyRequired') => SessionIssue.company,
        ApiFailure(unavailable: true) => SessionIssue.unavailable,
        _ => SessionIssue.unexpected,
      });
    } on PlatformException {
      _show(SessionPhase.signedOut, SessionIssue.storage);
    } on FormatException {
      _show(SessionPhase.signedOut, SessionIssue.unexpected);
    } on TypeError {
      _show(SessionPhase.signedOut, SessionIssue.unexpected);
    }
  }

  bool _allowedWorker(Credentials credentials) =>
      credentials.role == 'worker' &&
      (config.tenantId.isEmpty || credentials.tenantId == config.tenantId);

  Future<void> _verifyWarehouse() async {
    final credentials = _credentials;
    if (credentials == null || _phase == SessionPhase.checking) return;
    final sessionId = credentials.sessionId;
    _show(SessionPhase.checking);
    try {
      final result = await _authorizedWarehouse(credentials);
      if (!_isCurrent(sessionId)) return;
      if (result.tenantId != credentials.tenantId ||
          result.id != config.warehouseId) {
        await _end(
          SessionPhase.signedOut,
          issue: SessionIssue.warehouse,
          revoke: true,
        );
        return;
      }
      await _saveSession();
      if (!_isCurrent(sessionId)) return;
      _warehouse = result;
      _show(SessionPhase.ready);
    } on ApiFailure catch (failure) {
      if (!_isCurrent(sessionId)) return;
      switch (failure.status) {
        case 401:
          await _end(SessionPhase.expired);
        case 403 || 404:
          await _end(
            SessionPhase.signedOut,
            issue: SessionIssue.warehouse,
            revoke: true,
          );
        default:
          _show(
            SessionPhase.blocked,
            failure.unavailable
                ? SessionIssue.unavailable
                : SessionIssue.unexpected,
          );
      }
    } on PlatformException {
      if (_isCurrent(sessionId)) {
        _show(SessionPhase.blocked, SessionIssue.storage);
      }
    } on FormatException {
      if (_isCurrent(sessionId)) {
        _show(SessionPhase.blocked, SessionIssue.unexpected);
      }
    } on TypeError {
      if (_isCurrent(sessionId)) {
        _show(SessionPhase.blocked, SessionIssue.unexpected);
      }
    }
  }

  Future<Warehouse> _authorizedWarehouse(Credentials credentials) async {
    try {
      return await _api.getWarehouse(
        config.warehouseId,
        credentials.accessToken,
      );
    } on ApiFailure catch (failure) {
      if (failure.status != 401 || !_isCurrent(credentials.sessionId)) rethrow;
    }
    final refreshed = await _refresh(credentials);
    if (!_isCurrent(credentials.sessionId)) throw const ApiFailure(401);
    _credentials = refreshed;
    // Store the new pair before retrying the request. The old refresh token is now invalid.
    await _saveSession();
    if (!_isCurrent(credentials.sessionId)) throw const ApiFailure(401);
    return _api.getWarehouse(config.warehouseId, refreshed.accessToken);
  }

  Future<Credentials> _refresh(Credentials credentials) async {
    final existing = _refreshing;
    if (existing != null) return existing;
    final request = _api.refresh(credentials.refreshToken).then((updated) {
      if (!_allowedWorker(updated) ||
          updated.sessionId != credentials.sessionId ||
          updated.userId != credentials.userId ||
          updated.tenantId != credentials.tenantId) {
        throw const ApiFailure(401);
      }
      return updated;
    });
    _refreshing = request;
    try {
      return await request;
    } finally {
      _refreshing = null;
    }
  }

  bool _isCurrent(String sessionId) =>
      !_disposed && _credentials?.sessionId == sessionId;

  Future<void> retry() async {
    if (_phase == SessionPhase.blocked) await _verifyWarehouse();
    if (_phase == SessionPhase.storageBlocked) await signOut();
  }

  void dismissExpired() {
    if (_phase == SessionPhase.expired) _show(SessionPhase.signedOut, _issue);
  }

  Future<void> signOut() => _end(SessionPhase.signedOut, revoke: true);

  Future<void> _end(
    SessionPhase destination, {
    SessionIssue? issue,
    bool revoke = false,
  }) async {
    if (_disposed || _phase == SessionPhase.signingOut) return;
    final credentials = _credentials;
    final refresh = _refreshing;
    _credentials = null;
    _warehouse = null;
    _lastActivity = null;
    _lastSnapshot = null;
    _idleTimer?.cancel();
    _show(SessionPhase.signingOut);

    var cleared = true;
    try {
      await _store.clear();
    } on PlatformException {
      cleared = false;
    }
    if (revoke && credentials != null) {
      final revoked = await _revoke(credentials, refresh);
      if (!revoked) issue ??= SessionIssue.serverSignOut;
    }
    _show(
      cleared ? destination : SessionPhase.storageBlocked,
      cleared ? issue : SessionIssue.storage,
    );
  }

  Future<bool> _revoke(
    Credentials credentials,
    Future<Credentials>? inProgress,
  ) async {
    try {
      final current = inProgress == null ? credentials : await inProgress;
      try {
        await _api.signOut(current.accessToken);
      } on ApiFailure catch (failure) {
        if (failure.status != 401) rethrow;
        final renewed = await _refresh(current);
        await _api.signOut(renewed.accessToken);
      }
      return true;
    } on ApiFailure catch (failure) {
      return failure.status == 401;
    } on FormatException {
      return false;
    } on TypeError {
      return false;
    }
  }

  Duration get _remainingIdle {
    final lastActivity = _lastActivity;
    if (lastActivity == null) return Duration.zero;
    final elapsed = _clock().difference(lastActivity);
    return elapsed.isNegative ? Duration.zero : idleLimit - elapsed;
  }

  void markActivity() {
    if (_phase != SessionPhase.ready) return;
    if (_remainingIdle <= Duration.zero) {
      unawaited(_end(SessionPhase.expired, revoke: true));
      return;
    }
    final now = _clock();
    _lastActivity = now;
    _scheduleIdle();
    final lastSnapshot = _lastSnapshot;
    if (lastSnapshot == null ||
        now.difference(lastSnapshot) >= const Duration(seconds: 30)) {
      unawaited(_snapshotActivity());
    }
  }

  void backgrounded() {
    if (_phase == SessionPhase.ready) unawaited(_snapshotActivity());
  }

  Future<void> resumed() async {
    if (_credentials == null) return;
    if (_remainingIdle <= Duration.zero) {
      await _end(SessionPhase.expired, revoke: true);
    } else if (_phase == SessionPhase.ready || _phase == SessionPhase.blocked) {
      await _verifyWarehouse();
    }
  }

  void _scheduleIdle() {
    _idleTimer?.cancel();
    _idleTimer = Timer(
      _remainingIdle,
      () => unawaited(_end(SessionPhase.expired, revoke: true)),
    );
  }

  Future<void> _snapshotActivity() async {
    try {
      await _saveSession();
    } on PlatformException {
      // A previous snapshot expires earlier if the app is killed before another write.
    }
  }

  Future<void> _saveSession() {
    _lastSnapshot = _clock();
    return _store.save(
      StoredSession(config.sessionScope, _credentials!, _lastActivity!),
    );
  }

  void _show(SessionPhase phase, [SessionIssue? issue]) {
    if (_disposed) return;
    _phase = phase;
    _issue = issue;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _idleTimer?.cancel();
    super.dispose();
  }
}
