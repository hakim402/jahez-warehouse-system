import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'worker_order.dart';

class ApiFailure implements Exception {
  const ApiFailure([this.status, this.code]);

  final int? status;
  final String? code;

  bool get unavailable => status == null || status! >= 500;
}

class Credentials {
  const Credentials._({
    required this.accessToken,
    required this.refreshToken,
    required this.sessionId,
    required this.userId,
    required this.tenantId,
    required this.role,
  });

  factory Credentials.fromJson(Map<String, Object?> json) {
    final user = json['user'] as Map<String, Object?>;
    final credentials = Credentials._(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      sessionId: json['sessionId'] as String,
      userId: user['id'] as String,
      tenantId: user['tenantId'] as String,
      role: user['role'] as String,
    );
    final fields = [
      credentials.accessToken,
      credentials.refreshToken,
      credentials.sessionId,
      credentials.userId,
      credentials.tenantId,
      credentials.role,
    ];
    if (fields.any((field) => field.isEmpty)) {
      throw const FormatException('Incomplete session');
    }
    return credentials;
  }

  final String accessToken;
  final String refreshToken;
  final String sessionId;
  final String userId;
  final String tenantId;
  final String role;

  Map<String, Object?> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'sessionId': sessionId,
    'user': {'id': userId, 'tenantId': tenantId, 'role': role},
  };
}

class Warehouse {
  Warehouse.fromJson(Map<String, Object?> json)
    : id = json['id'] as String,
      tenantId = json['tenantId'] as String,
      name = json['name'] as String {
    if ([id, tenantId, name.trim()].any((value) => value.isEmpty)) {
      throw const FormatException('Incomplete warehouse');
    }
  }

  final String id;
  final String tenantId;
  final String name;

  Map<String, String> toJson() => {
    'id': id,
    'tenantId': tenantId,
    'name': name,
  };
}

class WorkerApi {
  WorkerApi(this._baseUrl, {this._client});

  static const _timeout = Duration(seconds: 12);

  final Uri? _baseUrl;
  HttpClient? _client;

  Future<Credentials> signIn({
    required String phone,
    required String password,
    required String deviceId,
    required String tenantId,
  }) async => Credentials.fromJson(
    await _request<Map<String, Object?>>(
      'POST',
      '/auth/login',
      body: {
        'phone': phone,
        'password': password,
        'deviceId': deviceId,
        if (tenantId.isNotEmpty) 'tenantId': tenantId,
      },
    ),
  );

  Future<Credentials> refresh(String refreshToken) async =>
      Credentials.fromJson(
        await _request<Map<String, Object?>>(
          'POST',
          '/auth/refresh',
          body: {'refreshToken': refreshToken},
        ),
      );

  Future<Warehouse> getWarehouse(String id, String accessToken) async =>
      Warehouse.fromJson(
        await _request<Map<String, Object?>>(
          'GET',
          '/warehouses/$id',
          accessToken: accessToken,
        ),
      );

  Future<List<WorkerOrder>> getReceivingQueue(
    String warehouseId,
    String accessToken,
  ) async {
    final rows = await _request<List<Object?>>(
      'GET',
      '/orders/awaiting',
      accessToken: accessToken,
      query: {'warehouseId': warehouseId},
    );
    return rows
        .map((row) => WorkerOrder.fromJson(row as Map<String, Object?>))
        .toList();
  }

  Future<void> signOut(String accessToken) async {
    await _request('POST', '/auth/logout', accessToken: accessToken);
  }

  Future<T> _request<T>(
    String method,
    String path, {
    String? accessToken,
    Map<String, String>? body,
    Map<String, String>? query,
  }) async {
    final base = _baseUrl;
    if (base == null) throw StateError('Missing API configuration');
    final client = _client ??= HttpClient();

    HttpClientRequest? request;
    var timedOut = false;
    try {
      return await (() async {
        final outgoing = await client.openUrl(
          method,
          base.replace(path: '${base.path}$path', queryParameters: query),
        );
        request = outgoing;
        if (timedOut) {
          outgoing.abort();
          throw const ApiFailure();
        }
        outgoing.followRedirects = false;
        outgoing.headers.set(HttpHeaders.acceptHeader, 'application/json');
        if (accessToken != null) {
          outgoing.headers.set(
            HttpHeaders.authorizationHeader,
            'Bearer $accessToken',
          );
        }
        if (body != null) {
          outgoing.headers.contentType = ContentType.json;
          outgoing.write(jsonEncode(body));
        }

        final response = await outgoing.close();
        final status = response.statusCode;
        final text = await utf8.decoder.bind(response).join();
        if (status < 200 || status >= 300) {
          // Only the documented ambiguous-company response changes sign-in UI.
          final companyRequired =
              status == 400 &&
              text.contains('tenantId is required for this phone');
          throw ApiFailure(status, companyRequired ? 'companyRequired' : null);
        }
        return jsonDecode(text) as T;
      })().timeout(_timeout);
    } on TimeoutException {
      timedOut = true;
      request?.abort();
      throw const ApiFailure();
    } on IOException {
      throw const ApiFailure();
    }
  }

  void close() => _client?.close(force: true);
}
