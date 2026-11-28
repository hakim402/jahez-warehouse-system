import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';

QueryExecutor openWorkerDatabase() => LazyDatabase(() async {
  final directory = await getApplicationSupportDirectory();
  await directory.create(recursive: true);
  return NativeDatabase.createInBackground(
    File.fromUri(directory.uri.resolve('jahez_worker.sqlite')),
    setup: (database) => database.execute('PRAGMA secure_delete = ON'),
  );
});
