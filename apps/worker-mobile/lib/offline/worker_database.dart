import 'package:drift/drift.dart';

part 'worker_database.g.dart';

@DataClassName('CachedOrderRow')
class CachedOrders extends Table {
  TextColumn get scope => text()();
  TextColumn get orderId => text()();
  TextColumn get snapshot => text()();
  IntColumn get position => integer()();

  @override
  Set<Column> get primaryKey => {scope, orderId};
}

@DataClassName('ReceiptDraftRow')
class ReceiptDrafts extends Table {
  TextColumn get scope => text()();
  TextColumn get orderId => text()();
  TextColumn get draftId => text().unique()();
  TextColumn get snapshot => text()();
  TextColumn get cartonEdits => text()();
  TextColumn get lineDetails => text().nullable()();

  @override
  Set<Column> get primaryKey => {scope, orderId};
}

@DataClassName('LocalReceiptRow')
class LocalReceipts extends Table {
  TextColumn get ownerScope => text()();
  TextColumn get orderId => text()();
  TextColumn get operationId => text().unique()();
  TextColumn get snapshot => text()();
  TextColumn get payload => text()();

  @override
  Set<Column> get primaryKey => {ownerScope, orderId};
}

@DriftDatabase(tables: [CachedOrders, ReceiptDrafts, LocalReceipts])
class WorkerDatabase extends _$WorkerDatabase {
  WorkerDatabase(super.executor);

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onUpgrade: (migrator, from, to) => transaction(() async {
      if (from < 2) {
        await migrator.addColumn(receiptDrafts, receiptDrafts.lineDetails);
        await migrator.createTable(localReceipts);
      }
    }),
  );
}
