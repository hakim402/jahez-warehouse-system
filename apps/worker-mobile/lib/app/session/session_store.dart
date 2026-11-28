import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../api/worker_api.dart';

class StoredSession {
  const StoredSession(
    this.scope,
    this.credentials,
    this.lastActivity, {
    this.warehouse,
  });

  StoredSession.fromJson(Map<String, Object?> json)
    : scope = json['scope'] as String,
      credentials = Credentials.fromJson(
        json['credentials'] as Map<String, Object?>,
      ),
      warehouse = json['warehouse'] == null
          ? null
          : Warehouse.fromJson(json['warehouse'] as Map<String, Object?>),
      lastActivity = DateTime.fromMillisecondsSinceEpoch(
        json['lastActivity'] as int,
        isUtc: true,
      );

  final String scope;
  final Credentials credentials;
  final DateTime lastActivity;
  final Warehouse? warehouse;

  Map<String, Object?> toJson() => {
    'scope': scope,
    'credentials': credentials.toJson(),
    'lastActivity': lastActivity.millisecondsSinceEpoch,
    'warehouse': warehouse?.toJson(),
  };
}

class SessionStore {
  SessionStore([
    this._storage = const FlutterSecureStorage(
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.unlocked_this_device,
      ),
    ),
  ]);

  static const _sessionKey = 'worker.session.v1';
  static const _deviceKey = 'worker.device.v1';
  static const _languageKey = 'worker.language.v1';
  static const _timeout = Duration(seconds: 12);

  final FlutterSecureStorage _storage;
  Future<void> _writes = Future.value();

  Future<StoredSession?> read() async {
    final value = await _read(_sessionKey);
    if (value == null) return null;
    try {
      return StoredSession.fromJson(jsonDecode(value) as Map<String, Object?>);
    } on FormatException {
      await clear();
    } on TypeError {
      await clear();
    }
    return null;
  }

  Future<void> save(StoredSession session) =>
      _writeSession(jsonEncode(session.toJson()));

  Future<void> clear() => _writeSession(null);

  Future<void> _writeSession(String? value) {
    // Order persistence so an older token or activity write cannot undo sign-out.
    final write = _writes.then(
      (_) => value == null
          ? _storage.delete(key: _sessionKey)
          : _storage.write(key: _sessionKey, value: value),
    );
    _writes = write.then<void>(
      (_) {},
      onError: (Object error, StackTrace stack) {},
    );
    return _storageResult(write);
  }

  Future<String> deviceId() async {
    final existing = await _read(_deviceKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final random = Random.secure();
    final generated = base64UrlEncode(
      List.generate(24, (_) => random.nextInt(256)),
    );
    await _storageResult(_storage.write(key: _deviceKey, value: generated));
    return generated;
  }

  Future<String?> readLanguage() => _read(_languageKey);

  Future<void> saveLanguage(String code) =>
      _storageResult(_storage.write(key: _languageKey, value: code));

  Future<String?> _read(String key) => _storageResult(_storage.read(key: key));

  Future<T> _storageResult<T>(Future<T> operation) async {
    try {
      return await operation.timeout(_timeout);
    } on TimeoutException {
      throw PlatformException(code: 'secure_storage_timeout');
    } on MissingPluginException {
      throw PlatformException(code: 'secure_storage_unavailable');
    }
  }
}
