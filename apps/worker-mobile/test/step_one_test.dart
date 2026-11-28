import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_mobile/api/worker_api.dart';
import 'package:worker_mobile/api/worker_order.dart';
import 'package:worker_mobile/app/session/session_controller.dart';
import 'package:worker_mobile/app/session/session_store.dart';
import 'package:worker_mobile/app/worker_app.dart';
import 'package:worker_mobile/app/worker_config.dart';
import 'package:worker_mobile/offline/receiving_store.dart';

import 'fixtures/receiving_order.dart';

const _config = WorkerConfig(apiBaseUrl: 'https://test.invalid/api/v1');

void main() {
  late _TestApi api;
  late SessionStore store;
  late SessionController session;
  late DateTime clock;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    api = _TestApi();
    store = SessionStore();
    clock = DateTime.utc(2026, 11, 28, 12);
    session = SessionController(
      config: _config,
      api: api,
      store: store,
      clock: () => clock,
    );
  });

  tearDown(() {
    session.dispose();
    api.close();
  });

  test(
    'refreshes an expired token once and persists the rotated pair',
    () async {
      await session.start();
      await session.signIn('fixture-worker', 'fixture-password');
      expect(session.phase, SessionPhase.ready);
      final original = (await store.read())!.credentials;
      api.expired = true;

      final verification = session.resumed();
      await session.resumed();
      await verification;

      expect(api.refreshCount, 1);
      expect(api.receivedRefreshToken, original.refreshToken);
      expect((await store.read())!.credentials.refreshToken, 'rotated-refresh');
      expect(session.warehouse?.name, 'Test Warehouse');
    },
  );

  test(
    'keeps a verified warehouse during an outage and clears a revoked session',
    () async {
      await session.start();
      await session.signIn('fixture-worker', 'fixture-password');
      api.unavailable = true;
      await session.resumed();
      expect(session.phase, SessionPhase.ready);
      expect(session.warehouse?.name, 'Test Warehouse');
      expect(await store.read(), isNotNull);

      api.unavailable = false;
      api.revoked = true;
      await session.resumed();
      expect(session.phase, SessionPhase.expired);
      expect(await store.read(), isNull);
      expect(session.warehouse, isNull);
    },
  );

  test('requires a worker and server-verified warehouse membership', () async {
    await session.start();
    api.role = 'owner';
    await session.signIn('fixture-owner', 'fixture-password');
    expect(session.issue, SessionIssue.worker);
    expect(api.warehouseChecks, 0);

    api.role = 'worker';
    api.warehouseDenied = true;
    await session.signIn('fixture-worker', 'fixture-password');
    expect(session.issue, SessionIssue.warehouse);
    expect(api.signOutCount, 2);
    expect(await store.read(), isNull);
  });

  testWidgets('shows recovery when the device secure store stops responding', (
    tester,
  ) async {
    final plugin = _StalledStorage();
    final stalled = SessionController(
      config: _config,
      api: api,
      store: SessionStore(plugin),
    );
    addTearDown(stalled.dispose);
    final restoring = stalled.start();

    await tester.pump(const Duration(seconds: 12));
    await restoring;
    expect(stalled.phase, SessionPhase.storageBlocked);
    expect(stalled.issue, SessionIssue.storage);
    expect(api.warehouseChecks, 0);

    plugin.available = true;
    await stalled.retry();
    expect(stalled.phase, SessionPhase.signedOut);
    expect(plugin.reads, 2);
  });

  test(
    'ends an idle session on return and keeps identity scoped to the next worker',
    () async {
      await session.start();
      await session.signIn('fixture-worker', 'fixture-password');
      final device = api.deviceId;
      session.backgrounded();
      clock = clock.add(const Duration(minutes: 15));
      await session.resumed();
      expect(session.phase, SessionPhase.expired);
      expect(await store.read(), isNull);
      expect(api.signOutCount, 1);

      session.dismissExpired();
      await session.signIn('second-worker', 'fixture-password');
      expect((await store.read())!.credentials.userId, 'second-worker');
      expect(api.deviceId, device);
    },
  );

  test(
    'restores a valid session and expires a stale session after restart',
    () async {
      await session.start();
      await session.signIn('fixture-worker', 'fixture-password');

      final restarted = SessionController(
        config: _config,
        api: api,
        store: store,
        clock: () => clock,
      );
      addTearDown(restarted.dispose);
      await restarted.start();
      expect(restarted.phase, SessionPhase.ready);

      clock = clock.add(const Duration(minutes: 16));
      final stale = SessionController(
        config: _config,
        api: api,
        store: store,
        clock: () => clock,
      );
      addTearDown(stale.dispose);
      await stale.start();
      expect(stale.phase, SessionPhase.expired);
      expect(await store.read(), isNull);
    },
  );

  test(
    'does not restore credentials if sign-out races a token refresh',
    () async {
      await session.start();
      await session.signIn('fixture-worker', 'fixture-password');
      api.expired = true;
      api.refreshGate = Completer<void>();
      final verifying = session.resumed();
      await api.refreshStarted.future;
      final signingOut = session.signOut();
      api.refreshGate!.complete();
      await Future.wait([verifying, signingOut]);

      expect(api.refreshCount, 1);
      expect(api.signOutCount, 1);
      expect(session.phase, SessionPhase.signedOut);
      expect(await store.read(), isNull);
    },
  );

  for (final size in [const Size(320, 568), const Size(820, 1180)]) {
    testWidgets(
      'localizes the shell, signs out and remembers the language at ${size.width}px',
      (tester) async {
        await tester.binding.setSurfaceSize(size);
        addTearDown(() => tester.binding.setSurfaceSize(null));
        final receivingStore = _WidgetReceivingStore();
        await tester.pumpWidget(
          WorkerApp(config: _config, api: api, receivingStore: receivingStore),
        );
        await tester.pumpAndSettle();

        await tester.tap(find.text('العربية'));
        await tester.pumpAndSettle();
        expect(find.text('تسجيل الدخول'), findsNWidgets(2));
        expect(
          Directionality.of(tester.element(find.text('رقم الهاتف'))),
          TextDirection.rtl,
        );

        final fields = find.byType(TextFormField);
        await tester.enterText(fields.at(0), 'fixture-worker');
        await tester.enterText(fields.at(1), 'fixture-password');
        final submit = find.widgetWithText(FilledButton, 'تسجيل الدخول');
        await tester.ensureVisible(submit);
        await tester.tap(submit);
        await tester.pumpAndSettle();
        expect(find.text('Test Warehouse'), findsOneWidget);

        await tester.tap(find.text('الاستلام'));
        await tester.pumpAndSettle();
        api.queueOffline = true;
        await tester.tap(find.byTooltip('حاول مجددًا'));
        await tester.pumpAndSettle();
        expect(
          find.text('تُعرض الطلبات المحفوظة على هذا الجهاز.'),
          findsOneWidget,
        );
        await tester.tap(find.text('Synthetic Supplier'));
        await tester.pumpAndSettle();
        await tester.tap(find.byTooltip('إضافة كرتون واحد'));
        await tester.pumpAndSettle();
        expect(receivingStore.drafts.values.single.cartons, {'line-one': 5});
        await tester.tap(find.widgetWithText(FilledButton, 'تم'));
        await tester.pumpAndSettle();
        await tester.tap(find.byType(BackButton));
        await tester.pumpAndSettle();

        await tester.tap(find.text('الإعدادات'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('简体中文'));
        await tester.pumpAndSettle();
        expect(find.text('语言'), findsOneWidget);
        expect(
          Directionality.of(tester.element(find.text('语言'))),
          TextDirection.ltr,
        );

        await tester.tap(find.widgetWithText(OutlinedButton, '退出登录'));
        await tester.pumpAndSettle();
        expect(find.text('退出登录会删除此设备上的 1 份草稿。'), findsOneWidget);
        await tester.tap(find.widgetWithText(FilledButton, '退出登录'));
        await tester.pumpAndSettle();
        expect(find.byType(TextFormField), findsNWidgets(2));
        expect(api.signOutCount, 1);
        expect(receivingStore.drafts, isEmpty);

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpWidget(
          WorkerApp(config: _config, api: api, receivingStore: receivingStore),
        );
        await tester.pumpAndSettle();
        expect(find.text('手机号码'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}

class _WidgetReceivingStore implements ReceivingStore {
  List<WorkerOrder> orders = [];
  final drafts = <String, ReceiptDraft>{};

  @override
  Future<void> close() async {}

  @override
  Future<int> countDrafts(String scope) async => drafts.length;

  @override
  Future<void> purge() async {
    orders = [];
    drafts.clear();
  }

  @override
  Future<CachedReceiving> read(String scope) async =>
      CachedReceiving(orders, Map.of(drafts));

  @override
  Future<void> replaceQueue(
    String scope,
    List<WorkerOrder> orders,
    bool Function() active,
  ) async {
    if (active()) this.orders = orders;
  }

  @override
  Future<ReceiptDraft?> saveCartons(
    String scope,
    WorkerOrder order,
    WorkerOrderLine line,
    int cartons,
    bool Function() active,
  ) async {
    if (!active()) return null;
    final draft = ReceiptDraft('draft', order, {line.id: cartons});
    drafts[order.id] = draft;
    return draft;
  }
}

class _StalledStorage extends FlutterSecureStorage {
  bool available = false;
  int reads = 0;

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) {
    reads++;
    return available ? Future.value(null) : Completer<String?>().future;
  }
}

class _TestApi extends WorkerApi {
  _TestApi() : super(_config.apiUri);

  bool expired = false;
  bool unavailable = false;
  bool queueOffline = false;
  bool revoked = false;
  bool warehouseDenied = false;
  String role = 'worker';
  String? deviceId;
  String? receivedRefreshToken;
  int refreshCount = 0;
  int signOutCount = 0;
  int warehouseChecks = 0;
  Completer<void>? refreshGate;
  final refreshStarted = Completer<void>();
  String _id = 'fixture-worker';

  Credentials _credentials(String prefix) => Credentials.fromJson({
    'accessToken': '$prefix-access',
    'refreshToken': '$prefix-refresh',
    'sessionId': 'session-$_id',
    'user': {'id': _id, 'role': role, 'tenantId': 'fixture-tenant'},
  });

  @override
  Future<Credentials> signIn({
    required String phone,
    required String password,
    required String deviceId,
    required String tenantId,
  }) async {
    this.deviceId = deviceId;
    _id = phone;
    return _credentials('initial');
  }

  @override
  Future<Credentials> refresh(String refreshToken) async {
    receivedRefreshToken = refreshToken;
    refreshCount++;
    if (!refreshStarted.isCompleted) refreshStarted.complete();
    if (refreshGate != null) await refreshGate!.future;
    if (revoked) throw const ApiFailure(401);
    expired = false;
    return _credentials('rotated');
  }

  @override
  Future<Warehouse> getWarehouse(String id, String accessToken) async {
    warehouseChecks++;
    if (unavailable) throw const ApiFailure(503);
    if (expired || revoked) throw const ApiFailure(401);
    if (warehouseDenied) throw const ApiFailure(403);
    return Warehouse.fromJson({
      'id': id,
      'tenantId': 'fixture-tenant',
      'name': 'Test Warehouse',
    });
  }

  @override
  Future<List<WorkerOrder>> getReceivingQueue(
    String warehouseId,
    String accessToken,
  ) async {
    if (queueOffline) throw const ApiFailure();
    return [fixtureOrder()];
  }

  @override
  Future<void> signOut(String accessToken) async {
    signOutCount++;
  }
}
