import 'package:drift/drift.dart';

QueryExecutor openWorkerDatabase() => LazyDatabase(
  () =>
      throw UnsupportedError('Worker Mobile storage requires a native device'),
);
