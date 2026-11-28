import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../api/worker_order.dart';
import 'worker_database.dart';

class ReceiptDraft {
  const ReceiptDraft(this.id, this.order, this.cartons);

  final String id;
  final WorkerOrder order;
  final Map<String, int> cartons;
}

class CachedReceiving {
  const CachedReceiving(this.orders, this.drafts);

  final List<WorkerOrder> orders;
  final Map<String, ReceiptDraft> drafts;
}

class ReceivingStore {
  ReceivingStore(this._database);

  final WorkerDatabase _database;

  Future<CachedReceiving> read(String scope) => _database.transaction(() async {
    final queue =
        await (_database.select(_database.cachedOrders)
              ..where((row) => row.scope.equals(scope))
              ..orderBy([(row) => OrderingTerm.asc(row.position)]))
            .get();
    final drafts = await (_database.select(
      _database.receiptDrafts,
    )..where((row) => row.scope.equals(scope))).get();
    return CachedReceiving(
      queue.map((row) => _decodeOrder(row.snapshot)).toList(),
      {for (final row in drafts) row.orderId: _decodeDraft(row)},
    );
  });

  Future<void> replaceQueue(
    String scope,
    List<WorkerOrder> orders,
    bool Function() active,
  ) {
    final ids = orders.map((order) => order.id).toSet();
    if (ids.length != orders.length) {
      throw const FormatException('Duplicate receiving order');
    }
    return _database.transaction(() async {
      if (!active()) return;
      await (_database.delete(
        _database.cachedOrders,
      )..where((row) => row.scope.equals(scope))).go();
      await _database.batch((batch) {
        batch.insertAll(_database.cachedOrders, [
          for (final (index, order) in orders.indexed)
            CachedOrdersCompanion.insert(
              scope: scope,
              orderId: order.id,
              snapshot: jsonEncode(order.toJson()),
              position: index,
            ),
        ]);
      });
    });
  }

  Future<ReceiptDraft?> saveCartons(
    String scope,
    WorkerOrder order,
    WorkerOrderLine line,
    int cartons,
    bool Function() active,
  ) => _database.transaction(() async {
    if (!active()) return null;
    if (cartons < 0 || !order.lines.any((item) => item.id == line.id)) {
      throw ArgumentError('Invalid carton draft update');
    }

    final existing =
        await (_database.select(_database.receiptDrafts)..where(
              (row) => row.scope.equals(scope) & row.orderId.equals(order.id),
            ))
            .getSingleOrNull();
    final draft = existing == null ? null : _decodeDraft(existing);
    final next = ReceiptDraft(
      draft?.id ?? const Uuid().v4(),
      draft?.order ?? order,
      {...?draft?.cartons, line.id: cartons},
    );
    await _database
        .into(_database.receiptDrafts)
        .insertOnConflictUpdate(
          ReceiptDraftsCompanion.insert(
            scope: scope,
            orderId: order.id,
            draftId: next.id,
            snapshot: jsonEncode(next.order.toJson()),
            cartonEdits: jsonEncode(next.cartons),
          ),
        );
    return next;
  });

  Future<int> countDrafts(String scope) async {
    final count = _database.receiptDrafts.orderId.count();
    final scopeRows =
        await (_database.selectOnly(_database.receiptDrafts)
              ..addColumns([count])
              ..where(_database.receiptDrafts.scope.equals(scope)))
            .getSingle();
    return scopeRows.read(count) ?? 0;
  }

  Future<void> purge() => _database.transaction(() async {
    await _database.delete(_database.receiptDrafts).go();
    await _database.delete(_database.cachedOrders).go();
  });

  Future<void> close() => _database.close();

  WorkerOrder _decodeOrder(String stored) =>
      WorkerOrder.fromJson(jsonDecode(stored) as Map<String, Object?>);

  ReceiptDraft _decodeDraft(ReceiptDraftRow row) => ReceiptDraft(
    row.draftId,
    _decodeOrder(row.snapshot),
    (jsonDecode(row.cartonEdits) as Map<String, Object?>).cast<String, int>(),
  );
}
