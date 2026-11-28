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

  @override
  Set<Column> get primaryKey => {scope, orderId};
}

@DriftDatabase(tables: [CachedOrders, ReceiptDrafts])
class WorkerDatabase extends _$WorkerDatabase {
  WorkerDatabase(super.executor);

  @override
  int get schemaVersion => 1;
}
