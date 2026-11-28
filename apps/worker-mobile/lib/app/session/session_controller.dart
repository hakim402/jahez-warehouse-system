import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../../api/worker_api.dart';
import '../../api/worker_order.dart';
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
  privateData,
  serverSignOut,
}

class SessionController extends ChangeNotifier {
  SessionController({
    required this.config,
    required this._api,
    required this._store,
    this._purgePrivateData,
    this.idleLimit = const Duration(minutes: 15),
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final WorkerConfig config;
  final WorkerApi _api;
  final SessionStore _store;
  final Duration idleLimit;
  final DateTime Function() _clock;
  final Future<void> Function()? _purgePrivateData;

  SessionPhase _phase = SessionPhase.starting;
  SessionIssue? _issue;
  Credentials? _credentials;
  Warehouse? _warehouse;
  DateTime? _lastActivity;
  DateTime? _lastSnapshot;
  Timer? _idleTimer;
  Future<Credentials>? _refreshing;
  String? _verifyingSession;
  bool _disposed = false;
  bool _retryStartup = false;

  SessionPhase get phase => _phase;
  SessionIssue? get issue => _issue;
  Warehouse? get warehouse => _warehouse;
  String? get receivingScope {
    final credentials = _credentials;
    final owner = _receivingOwner;
    return owner == null
        ? null
        : jsonEncode([...owner, credentials!.sessionId]);
  }

  String? get receivingOwnerScope {
    final owner = _receivingOwner;
    return owner == null ? null : jsonEncode(owner);
  }

  List<String>? get _receivingOwner {
    final credentials = _credentials;
    if (_phase != SessionPhase.ready || credentials == null) return null;
    return [
      config.sessionScope,
      credentials.tenantId,
      credentials.userId,
      config.warehouseId,
    ];
  }

  Future<void> start() async {
    _retryStartup = false;
    try {
      final stored = await _store.read();
      if (_disposed) return;
      if (stored == null) {
        // A previous process may have ended after clearing credentials and before deleting drafts.
        if (!await _purgeLocalData()) {
          _blockStartup(SessionIssue.privateData);
          return;
        }
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
      final warehouse = stored.warehouse;
      if (warehouse != null &&
          _matchesWarehouse(warehouse, stored.credentials)) {
        _warehouse = warehouse;
      }
      _lastActivity = stored.lastActivity;
      if (_remainingIdle <= Duration.zero) {
        await _end(SessionPhase.expired, revoke: true);
        return;
      }
      _scheduleIdle();
      await _verifyWarehouse();
    } on PlatformException {
      _blockStartup(SessionIssue.storage);
    }
  }

  void _blockStartup(SessionIssue issue) {
    _retryStartup = true;
    _show(SessionPhase.storageBlocked, issue);
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

  bool _matchesWarehouse(Warehouse warehouse, Credentials credentials) =>
      warehouse.id == config.warehouseId &&
      warehouse.tenantId == credentials.tenantId;

  Future<void> _verifyWarehouse() async {
    final credentials = _credentials;
    if (credentials == null || _verifyingSession == credentials.sessionId) {
      return;
    }
    final sessionId = credentials.sessionId;
    _verifyingSession = sessionId;
    if (_phase != SessionPhase.ready) _show(SessionPhase.checking);
    try {
      final result = await _authorized(
        credentials,
        (token) => _api.getWarehouse(config.warehouseId, token),
      );
      if (!_isCurrent(sessionId)) return;
      if (!_matchesWarehouse(result, credentials)) {
        await _end(
          SessionPhase.signedOut,
          issue: SessionIssue.warehouse,
          revoke: true,
        );
        return;
      }
      _warehouse = result;
      await _saveSession();
      if (!_isCurrent(sessionId)) return;
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
          if (failure.unavailable && _warehouse != null) {
            _show(SessionPhase.ready);
            return;
          }
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
    } finally {
      if (_verifyingSession == sessionId) _verifyingSession = null;
    }
  }

  Future<List<WorkerOrder>> fetchReceivingQueue(String scope) async {
    final credentials = _credentials;
    if (receivingScope != scope || credentials == null) {
      throw const ApiFailure(401);
    }
    try {
      return await _authorized(
        credentials,
        (token) => _api.getReceivingQueue(config.warehouseId, token),
      );
    } on ApiFailure catch (failure) {
      if (_isCurrent(credentials.sessionId)) {
        if (failure.status == 401) {
          await _end(SessionPhase.expired);
        } else if (failure.status == 403) {
          await _end(
            SessionPhase.signedOut,
            issue: SessionIssue.warehouse,
            revoke: true,
          );
        }
      }
      rethrow;
    }
  }

  Future<T> _authorized<T>(
    Credentials credentials,
    Future<T> Function(String) fetch,
  ) async {
    try {
      return await fetch(credentials.accessToken);
    } on ApiFailure catch (failure) {
      if (failure.status != 401 || !_isCurrent(credentials.sessionId)) rethrow;
    }
    final current = _credentials!;
    if (current.accessToken != credentials.accessToken) {
      return fetch(current.accessToken);
    }
    final refreshed = await _refresh(credentials);
    if (!_isCurrent(credentials.sessionId)) throw const ApiFailure(401);
    _credentials = refreshed;
    // Store the new pair before retrying the request. The old refresh token is now invalid.
    await _saveSession();
    if (!_isCurrent(credentials.sessionId)) throw const ApiFailure(401);
    return fetch(refreshed.accessToken);
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
    if (_phase != SessionPhase.storageBlocked) return;
    if (_retryStartup) {
      _show(SessionPhase.starting);
      await start();
    } else {
      await signOut();
    }
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

    SessionIssue? cleanupIssue;
    try {
      await _store.clear();
    } on PlatformException {
      cleanupIssue = SessionIssue.storage;
    }
    if (cleanupIssue == null && !await _purgeLocalData()) {
      cleanupIssue = SessionIssue.privateData;
    }
    if (revoke && credentials != null) {
      final revoked = await _revoke(credentials, refresh);
      if (!revoked) issue ??= SessionIssue.serverSignOut;
    }
    _show(
      cleanupIssue == null ? destination : SessionPhase.storageBlocked,
      cleanupIssue ?? issue,
    );
  }

  Future<bool> _purgeLocalData() async {
    try {
      await _purgePrivateData?.call().timeout(const Duration(seconds: 12));
      return true;
    } catch (_) {
      return false;
    }
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
      StoredSession(
        config.sessionScope,
        _credentials!,
        _lastActivity!,
        warehouse: _warehouse,
      ),
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
