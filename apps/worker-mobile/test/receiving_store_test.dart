import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_mobile/offline/receiving_store.dart';
import 'package:worker_mobile/offline/worker_database.dart';

import 'fixtures/receiving_order.dart';

void main() {
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
