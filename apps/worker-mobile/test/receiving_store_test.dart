import 'dart:convert';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:worker_mobile/offline/receiving_store.dart';
import 'package:worker_mobile/offline/worker_database.dart';

import 'fixtures/receiving_order.dart';

void main() {
  test(
    'migrates a version 1 draft and confirms it once for its owner',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'jahez-receipt-v1',
      );
      addTearDown(() => directory.delete(recursive: true));
      final file = File.fromUri(directory.uri.resolve('worker.sqlite'));
      final order = fixtureOrder();
      const draftId = '36ddb82b-45ec-47da-8e40-88629c180cc9';
      final v1 = sqlite3.open(file.path);
      v1.execute('''
      CREATE TABLE cached_orders (
        scope TEXT NOT NULL, order_id TEXT NOT NULL, snapshot TEXT NOT NULL,
        position INTEGER NOT NULL, PRIMARY KEY (scope, order_id)
      );
      CREATE TABLE receipt_drafts (
        scope TEXT NOT NULL, order_id TEXT NOT NULL, draft_id TEXT NOT NULL UNIQUE,
        snapshot TEXT NOT NULL, carton_edits TEXT NOT NULL,
        PRIMARY KEY (scope, order_id)
      );
      PRAGMA user_version = 1;
    ''');
      v1.execute('INSERT INTO receipt_drafts VALUES (?, ?, ?, ?, ?)', [
        'worker-session-1',
        order.id,
        draftId,
        jsonEncode(order.toJson()),
        '{"line-one":2}',
      ]);
      v1.close();

      var store = ReceivingStore(WorkerDatabase(NativeDatabase(file)));
      final migrated = (await store.read('worker-session-1')).drafts[order.id]!;
      expect(migrated.id, draftId);
      expect(migrated.cartons, {'line-one': 2});
      expect(migrated.details, isEmpty);
      await store.saveDetails(
        'worker-session-1',
        'worker-a',
        order,
        order.lines.single,
        const ReceiptLineDetails(
          damaged: true,
          measurements: ReceiptMeasurements(
            lengthCm: 60,
            widthCm: 45,
            heightCm: 9,
            weightKg: 12.5,
          ),
        ),
        () => true,
      );
      final confirmations = await Future.wait([
        for (var attempt = 0; attempt < 2; attempt++)
          store.confirm(
            'worker-session-1',
            'worker-a',
            'yiwu',
            order,
            () => true,
          ),
      ]);
      final saved = confirmations.first!;
      expect(saved.operationId, draftId);
      expect(confirmations.last?.payload, saved.payload);
      expect(saved.delivery.single.missing, 2);
      expect(saved.delivery.single.details.measurements.cbm(2), 0.0486);
      expect((await store.read('worker-session-1')).drafts, isEmpty);
      await store.purge();
      await store.close();

      store = ReceivingStore(WorkerDatabase(NativeDatabase(file)));
      addTearDown(store.close);
      final recovered = await store.read(
        'worker-session-2',
        ownerScope: 'worker-a',
      );
      expect(recovered.receipts[order.id]?.payload, saved.payload);
      expect(
        (await store.read('worker-b-session', ownerScope: 'worker-b')).receipts,
        isEmpty,
      );
    },
  );

  test(
    'cache and draft survive reopening, isolate scopes and purge on sign-out',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'jahez-receiving-test',
      );
      addTearDown(() => directory.delete(recursive: true));
      final file = File.fromUri(directory.uri.resolve('receiving.sqlite'));
      var database = WorkerDatabase(NativeDatabase(file));
      var store = ReceivingStore(database);
      final order = fixtureOrder();
      const workerA = 'tenant-a/worker-a/warehouse-a';
      const workerB = 'tenant-a/worker-b/warehouse-a';

      await store.replaceQueue(workerA, [order], () => true);
      final draft = await store.saveCartons(
        workerA,
        order,
        order.lines.single,
        2,
        () => true,
      );
      expect(draft, isNotNull);
      expect(
        (await database.select(database.cachedOrders).get()).single.snapshot,
        isNot(contains('never-store-this')),
      );
      expect(
        (await database.select(database.receiptDrafts).get()).single.snapshot,
        isNot(contains('never-store-this')),
      );
      await store.close();

      database = WorkerDatabase(NativeDatabase(file));
      store = ReceivingStore(database);
      addTearDown(store.close);
      final persisted = await store.read(workerA);
      expect(persisted.orders.single.id, order.id);
      expect(persisted.drafts[order.id]?.id, draft!.id);
      expect(persisted.drafts[order.id]?.cartons, {'line-one': 2});
      expect(await store.countDrafts(workerA), 1);
      expect((await store.read(workerB)).orders, isEmpty);
      expect((await store.read(workerB)).drafts, isEmpty);

      expect(
        () => store.replaceQueue(workerA, [order, order], () => true),
        throwsFormatException,
      );
      expect((await store.read(workerA)).orders, hasLength(1));
      await store.replaceQueue(workerA, [], () => true);
      expect((await store.read(workerA)).orders, isEmpty);
      final updated = await store.saveCartons(
        workerA,
        order,
        order.lines.single,
        3,
        () => true,
      );
      expect(updated?.id, draft.id);

      await store.purge();
      await store.replaceQueue(workerA, [order], () => false);
      expect(
        await store.saveCartons(
          workerA,
          order,
          order.lines.single,
          1,
          () => false,
        ),
        isNull,
      );
      expect((await store.read(workerA)).orders, isEmpty);
      expect(await store.countDrafts(workerA), 0);
    },
  );
}
