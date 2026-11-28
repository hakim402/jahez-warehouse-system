import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../api/worker_order.dart';
import 'receiving_receipt.dart';
import 'worker_database.dart';

export 'receiving_receipt.dart';

class CachedReceiving {
  const CachedReceiving(this.orders, this.drafts, {this.receipts = const {}});

  final List<WorkerOrder> orders;
  final Map<String, ReceiptDraft> drafts;
  final Map<String, LocalReceipt> receipts;
}

class ReceivingStore {
  ReceivingStore(this._database);

  final WorkerDatabase _database;

  Future<CachedReceiving> read(String scope, {String? ownerScope}) =>
      _database.transaction(() async {
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
          receipts: ownerScope == null
              ? const {}
              : {
                  for (final row in await (_database.select(
                    _database.localReceipts,
                  )..where((row) => row.ownerScope.equals(ownerScope))).get())
                    row.orderId: _decodeReceipt(row),
                },
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
    bool Function() active, {
    String? ownerScope,
  }) {
    if (cartons < 0 || cartons > line.maximumReceiptCartons) {
      throw ArgumentError('Invalid carton draft update');
    }
    return _updateDraft(
      scope,
      ownerScope,
      order,
      line,
      active,
      (draft) => ReceiptDraft(draft.id, draft.order, {
        ...draft.cartons,
        line.id: cartons,
      }, details: draft.details),
    );
  }

  Future<ReceiptDraft?> saveDetails(
    String scope,
    String ownerScope,
    WorkerOrder order,
    WorkerOrderLine line,
    ReceiptLineDetails details,
    bool Function() active,
  ) => _updateDraft(
    scope,
    ownerScope,
    order,
    line,
    active,
    (draft) => ReceiptDraft(
      draft.id,
      draft.order,
      draft.cartons,
      details: {...draft.details, line.id: details},
    ),
  );

  Future<ReceiptDraft?> _updateDraft(
    String scope,
    String? ownerScope,
    WorkerOrder order,
    WorkerOrderLine line,
    bool Function() active,
    ReceiptDraft Function(ReceiptDraft) update,
  ) => _database.transaction(() async {
    if (!active()) return null;
    if (!order.lines.any((item) => item.id == line.id)) {
      throw ArgumentError('Invalid receiving order line');
    }
    if (ownerScope != null && await _receipt(ownerScope, order.id) != null) {
      return null;
    }
    final draft = await _draft(scope, order.id);
    if (!active()) return null;
    final next = update(
      draft ?? ReceiptDraft(const Uuid().v4(), order, const {}),
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
            lineDetails: Value(
              jsonEncode(
                next.details.map(
                  (id, details) => MapEntry(id, details.toJson()),
                ),
              ),
            ),
          ),
        );
    return next;
  });

  Future<LocalReceipt?> confirm(
    String scope,
    String ownerScope,
    String warehouseId,
    WorkerOrder order,
    bool Function() active,
  ) => _database.transaction(() async {
    if (!active()) return null;
    final existing = await _receipt(ownerScope, order.id);
    if (existing != null) return _decodeReceipt(existing);
    final draft =
        await _draft(scope, order.id) ??
        ReceiptDraft(const Uuid().v4(), order, const {});
    if (!active()) return null;
    final lines = draft.delivery;
    final delivered = lines.where((line) => line.cartons > 0).toList();
    if (delivered.isEmpty || lines.any((line) => !line.isValid)) {
      throw ArgumentError('Invalid receipt quantities or volume');
    }
    final payload = <String, Object?>{
      'clientOperationId': draft.id,
      'warehouseId': warehouseId,
      'orderId': order.id,
      'receivedAt': DateTime.now().toUtc().toIso8601String(),
      'lines': delivered.map((line) => line.toJson()).toList(),
    };
    await _database
        .into(_database.localReceipts)
        .insert(
          LocalReceiptsCompanion.insert(
            ownerScope: ownerScope,
            orderId: order.id,
            operationId: draft.id,
            snapshot: jsonEncode(draft.order.toJson()),
            payload: jsonEncode(payload),
          ),
        );
    await (_database.delete(_database.receiptDrafts)..where(
          (row) => row.scope.equals(scope) & row.orderId.equals(order.id),
        ))
        .go();
    return LocalReceipt(draft.order, payload);
  });

  Future<ReceiptDraft?> _draft(String scope, String orderId) async {
    final row =
        await (_database.select(_database.receiptDrafts)..where(
              (row) => row.scope.equals(scope) & row.orderId.equals(orderId),
            ))
            .getSingleOrNull();
    return row == null ? null : _decodeDraft(row);
  }

  Future<LocalReceiptRow?> _receipt(String ownerScope, String orderId) =>
      (_database.select(_database.localReceipts)..where(
            (row) =>
                row.ownerScope.equals(ownerScope) & row.orderId.equals(orderId),
          ))
          .getSingleOrNull();

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
    // Confirmed receipts must remain available to the original worker for sync.
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
    details: (jsonDecode(row.lineDetails ?? '{}') as Map<String, Object?>).map(
      (id, data) => MapEntry(
        id,
        ReceiptLineDetails.fromJson(data as Map<String, Object?>),
      ),
    ),
  );

  LocalReceipt _decodeReceipt(LocalReceiptRow row) => LocalReceipt(
    _decodeOrder(row.snapshot),
    jsonDecode(row.payload) as Map<String, Object?>,
  );
}
