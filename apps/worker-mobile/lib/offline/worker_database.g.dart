// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'worker_database.dart';

// ignore_for_file: type=lint
class $CachedOrdersTable extends CachedOrders
    with TableInfo<$CachedOrdersTable, CachedOrderRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedOrdersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _scopeMeta = const VerificationMeta('scope');
  @override
  late final GeneratedColumn<String> scope = GeneratedColumn<String>(
    'scope',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _orderIdMeta = const VerificationMeta(
    'orderId',
  );
  @override
  late final GeneratedColumn<String> orderId = GeneratedColumn<String>(
    'order_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _snapshotMeta = const VerificationMeta(
    'snapshot',
  );
  @override
  late final GeneratedColumn<String> snapshot = GeneratedColumn<String>(
    'snapshot',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _positionMeta = const VerificationMeta(
    'position',
  );
  @override
  late final GeneratedColumn<int> position = GeneratedColumn<int>(
    'position',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [scope, orderId, snapshot, position];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_orders';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedOrderRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('scope')) {
      context.handle(
        _scopeMeta,
        scope.isAcceptableOrUnknown(data['scope']!, _scopeMeta),
      );
    } else if (isInserting) {
      context.missing(_scopeMeta);
    }
    if (data.containsKey('order_id')) {
      context.handle(
        _orderIdMeta,
        orderId.isAcceptableOrUnknown(data['order_id']!, _orderIdMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIdMeta);
    }
    if (data.containsKey('snapshot')) {
      context.handle(
        _snapshotMeta,
        snapshot.isAcceptableOrUnknown(data['snapshot']!, _snapshotMeta),
      );
    } else if (isInserting) {
      context.missing(_snapshotMeta);
    }
    if (data.containsKey('position')) {
      context.handle(
        _positionMeta,
        position.isAcceptableOrUnknown(data['position']!, _positionMeta),
      );
    } else if (isInserting) {
      context.missing(_positionMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {scope, orderId};
  @override
  CachedOrderRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedOrderRow(
      scope: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}scope'],
      )!,
      orderId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}order_id'],
      )!,
      snapshot: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}snapshot'],
      )!,
      position: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}position'],
      )!,
    );
  }

  @override
  $CachedOrdersTable createAlias(String alias) {
    return $CachedOrdersTable(attachedDatabase, alias);
  }
}

class CachedOrderRow extends DataClass implements Insertable<CachedOrderRow> {
  final String scope;
  final String orderId;
  final String snapshot;
  final int position;
  const CachedOrderRow({
    required this.scope,
    required this.orderId,
    required this.snapshot,
    required this.position,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['scope'] = Variable<String>(scope);
    map['order_id'] = Variable<String>(orderId);
    map['snapshot'] = Variable<String>(snapshot);
    map['position'] = Variable<int>(position);
    return map;
  }

  CachedOrdersCompanion toCompanion(bool nullToAbsent) {
    return CachedOrdersCompanion(
      scope: Value(scope),
      orderId: Value(orderId),
      snapshot: Value(snapshot),
      position: Value(position),
    );
  }

  factory CachedOrderRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedOrderRow(
      scope: serializer.fromJson<String>(json['scope']),
      orderId: serializer.fromJson<String>(json['orderId']),
      snapshot: serializer.fromJson<String>(json['snapshot']),
      position: serializer.fromJson<int>(json['position']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'scope': serializer.toJson<String>(scope),
      'orderId': serializer.toJson<String>(orderId),
      'snapshot': serializer.toJson<String>(snapshot),
      'position': serializer.toJson<int>(position),
    };
  }

  CachedOrderRow copyWith({
    String? scope,
    String? orderId,
    String? snapshot,
    int? position,
  }) => CachedOrderRow(
    scope: scope ?? this.scope,
    orderId: orderId ?? this.orderId,
    snapshot: snapshot ?? this.snapshot,
    position: position ?? this.position,
  );
  CachedOrderRow copyWithCompanion(CachedOrdersCompanion data) {
    return CachedOrderRow(
      scope: data.scope.present ? data.scope.value : this.scope,
      orderId: data.orderId.present ? data.orderId.value : this.orderId,
      snapshot: data.snapshot.present ? data.snapshot.value : this.snapshot,
      position: data.position.present ? data.position.value : this.position,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedOrderRow(')
          ..write('scope: $scope, ')
          ..write('orderId: $orderId, ')
          ..write('snapshot: $snapshot, ')
          ..write('position: $position')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(scope, orderId, snapshot, position);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedOrderRow &&
          other.scope == this.scope &&
          other.orderId == this.orderId &&
          other.snapshot == this.snapshot &&
          other.position == this.position);
}

class CachedOrdersCompanion extends UpdateCompanion<CachedOrderRow> {
  final Value<String> scope;
  final Value<String> orderId;
  final Value<String> snapshot;
  final Value<int> position;
  final Value<int> rowid;
  const CachedOrdersCompanion({
    this.scope = const Value.absent(),
    this.orderId = const Value.absent(),
    this.snapshot = const Value.absent(),
    this.position = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedOrdersCompanion.insert({
    required String scope,
    required String orderId,
    required String snapshot,
    required int position,
    this.rowid = const Value.absent(),
  }) : scope = Value(scope),
       orderId = Value(orderId),
       snapshot = Value(snapshot),
       position = Value(position);
  static Insertable<CachedOrderRow> custom({
    Expression<String>? scope,
    Expression<String>? orderId,
    Expression<String>? snapshot,
    Expression<int>? position,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (scope != null) 'scope': scope,
      if (orderId != null) 'order_id': orderId,
      if (snapshot != null) 'snapshot': snapshot,
      if (position != null) 'position': position,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedOrdersCompanion copyWith({
    Value<String>? scope,
    Value<String>? orderId,
    Value<String>? snapshot,
    Value<int>? position,
    Value<int>? rowid,
  }) {
    return CachedOrdersCompanion(
      scope: scope ?? this.scope,
      orderId: orderId ?? this.orderId,
      snapshot: snapshot ?? this.snapshot,
      position: position ?? this.position,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (scope.present) {
      map['scope'] = Variable<String>(scope.value);
    }
    if (orderId.present) {
      map['order_id'] = Variable<String>(orderId.value);
    }
    if (snapshot.present) {
      map['snapshot'] = Variable<String>(snapshot.value);
    }
    if (position.present) {
      map['position'] = Variable<int>(position.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedOrdersCompanion(')
          ..write('scope: $scope, ')
          ..write('orderId: $orderId, ')
          ..write('snapshot: $snapshot, ')
          ..write('position: $position, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ReceiptDraftsTable extends ReceiptDrafts
    with TableInfo<$ReceiptDraftsTable, ReceiptDraftRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ReceiptDraftsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _scopeMeta = const VerificationMeta('scope');
  @override
  late final GeneratedColumn<String> scope = GeneratedColumn<String>(
    'scope',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _orderIdMeta = const VerificationMeta(
    'orderId',
  );
  @override
  late final GeneratedColumn<String> orderId = GeneratedColumn<String>(
    'order_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _draftIdMeta = const VerificationMeta(
    'draftId',
  );
  @override
  late final GeneratedColumn<String> draftId = GeneratedColumn<String>(
    'draft_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _snapshotMeta = const VerificationMeta(
    'snapshot',
  );
  @override
  late final GeneratedColumn<String> snapshot = GeneratedColumn<String>(
    'snapshot',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cartonEditsMeta = const VerificationMeta(
    'cartonEdits',
  );
  @override
  late final GeneratedColumn<String> cartonEdits = GeneratedColumn<String>(
    'carton_edits',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    scope,
    orderId,
    draftId,
    snapshot,
    cartonEdits,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'receipt_drafts';
  @override
  VerificationContext validateIntegrity(
    Insertable<ReceiptDraftRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('scope')) {
      context.handle(
        _scopeMeta,
        scope.isAcceptableOrUnknown(data['scope']!, _scopeMeta),
      );
    } else if (isInserting) {
      context.missing(_scopeMeta);
    }
    if (data.containsKey('order_id')) {
      context.handle(
        _orderIdMeta,
        orderId.isAcceptableOrUnknown(data['order_id']!, _orderIdMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIdMeta);
    }
    if (data.containsKey('draft_id')) {
      context.handle(
        _draftIdMeta,
        draftId.isAcceptableOrUnknown(data['draft_id']!, _draftIdMeta),
      );
    } else if (isInserting) {
      context.missing(_draftIdMeta);
    }
    if (data.containsKey('snapshot')) {
      context.handle(
        _snapshotMeta,
        snapshot.isAcceptableOrUnknown(data['snapshot']!, _snapshotMeta),
      );
    } else if (isInserting) {
      context.missing(_snapshotMeta);
    }
    if (data.containsKey('carton_edits')) {
      context.handle(
        _cartonEditsMeta,
        cartonEdits.isAcceptableOrUnknown(
          data['carton_edits']!,
          _cartonEditsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_cartonEditsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {scope, orderId};
  @override
  ReceiptDraftRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ReceiptDraftRow(
      scope: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}scope'],
      )!,
      orderId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}order_id'],
      )!,
      draftId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}draft_id'],
      )!,
      snapshot: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}snapshot'],
      )!,
      cartonEdits: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}carton_edits'],
      )!,
    );
  }

  @override
  $ReceiptDraftsTable createAlias(String alias) {
    return $ReceiptDraftsTable(attachedDatabase, alias);
  }
}

class ReceiptDraftRow extends DataClass implements Insertable<ReceiptDraftRow> {
  final String scope;
  final String orderId;
  final String draftId;
  final String snapshot;
  final String cartonEdits;
  const ReceiptDraftRow({
    required this.scope,
    required this.orderId,
    required this.draftId,
    required this.snapshot,
    required this.cartonEdits,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['scope'] = Variable<String>(scope);
    map['order_id'] = Variable<String>(orderId);
    map['draft_id'] = Variable<String>(draftId);
    map['snapshot'] = Variable<String>(snapshot);
    map['carton_edits'] = Variable<String>(cartonEdits);
    return map;
  }

  ReceiptDraftsCompanion toCompanion(bool nullToAbsent) {
    return ReceiptDraftsCompanion(
      scope: Value(scope),
      orderId: Value(orderId),
      draftId: Value(draftId),
      snapshot: Value(snapshot),
      cartonEdits: Value(cartonEdits),
    );
  }

  factory ReceiptDraftRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ReceiptDraftRow(
      scope: serializer.fromJson<String>(json['scope']),
      orderId: serializer.fromJson<String>(json['orderId']),
      draftId: serializer.fromJson<String>(json['draftId']),
      snapshot: serializer.fromJson<String>(json['snapshot']),
      cartonEdits: serializer.fromJson<String>(json['cartonEdits']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'scope': serializer.toJson<String>(scope),
      'orderId': serializer.toJson<String>(orderId),
      'draftId': serializer.toJson<String>(draftId),
      'snapshot': serializer.toJson<String>(snapshot),
      'cartonEdits': serializer.toJson<String>(cartonEdits),
    };
  }

  ReceiptDraftRow copyWith({
    String? scope,
    String? orderId,
    String? draftId,
    String? snapshot,
    String? cartonEdits,
  }) => ReceiptDraftRow(
    scope: scope ?? this.scope,
    orderId: orderId ?? this.orderId,
    draftId: draftId ?? this.draftId,
    snapshot: snapshot ?? this.snapshot,
    cartonEdits: cartonEdits ?? this.cartonEdits,
  );
  ReceiptDraftRow copyWithCompanion(ReceiptDraftsCompanion data) {
    return ReceiptDraftRow(
      scope: data.scope.present ? data.scope.value : this.scope,
      orderId: data.orderId.present ? data.orderId.value : this.orderId,
      draftId: data.draftId.present ? data.draftId.value : this.draftId,
      snapshot: data.snapshot.present ? data.snapshot.value : this.snapshot,
      cartonEdits: data.cartonEdits.present
          ? data.cartonEdits.value
          : this.cartonEdits,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ReceiptDraftRow(')
          ..write('scope: $scope, ')
          ..write('orderId: $orderId, ')
          ..write('draftId: $draftId, ')
          ..write('snapshot: $snapshot, ')
          ..write('cartonEdits: $cartonEdits')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(scope, orderId, draftId, snapshot, cartonEdits);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ReceiptDraftRow &&
          other.scope == this.scope &&
          other.orderId == this.orderId &&
          other.draftId == this.draftId &&
          other.snapshot == this.snapshot &&
          other.cartonEdits == this.cartonEdits);
}

class ReceiptDraftsCompanion extends UpdateCompanion<ReceiptDraftRow> {
  final Value<String> scope;
  final Value<String> orderId;
  final Value<String> draftId;
  final Value<String> snapshot;
  final Value<String> cartonEdits;
  final Value<int> rowid;
  const ReceiptDraftsCompanion({
    this.scope = const Value.absent(),
    this.orderId = const Value.absent(),
    this.draftId = const Value.absent(),
    this.snapshot = const Value.absent(),
    this.cartonEdits = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ReceiptDraftsCompanion.insert({
    required String scope,
    required String orderId,
    required String draftId,
    required String snapshot,
    required String cartonEdits,
    this.rowid = const Value.absent(),
  }) : scope = Value(scope),
       orderId = Value(orderId),
       draftId = Value(draftId),
       snapshot = Value(snapshot),
       cartonEdits = Value(cartonEdits);
  static Insertable<ReceiptDraftRow> custom({
    Expression<String>? scope,
    Expression<String>? orderId,
    Expression<String>? draftId,
    Expression<String>? snapshot,
    Expression<String>? cartonEdits,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (scope != null) 'scope': scope,
      if (orderId != null) 'order_id': orderId,
      if (draftId != null) 'draft_id': draftId,
      if (snapshot != null) 'snapshot': snapshot,
      if (cartonEdits != null) 'carton_edits': cartonEdits,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ReceiptDraftsCompanion copyWith({
    Value<String>? scope,
    Value<String>? orderId,
    Value<String>? draftId,
    Value<String>? snapshot,
    Value<String>? cartonEdits,
    Value<int>? rowid,
  }) {
    return ReceiptDraftsCompanion(
      scope: scope ?? this.scope,
      orderId: orderId ?? this.orderId,
      draftId: draftId ?? this.draftId,
      snapshot: snapshot ?? this.snapshot,
      cartonEdits: cartonEdits ?? this.cartonEdits,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (scope.present) {
      map['scope'] = Variable<String>(scope.value);
    }
    if (orderId.present) {
      map['order_id'] = Variable<String>(orderId.value);
    }
    if (draftId.present) {
      map['draft_id'] = Variable<String>(draftId.value);
    }
    if (snapshot.present) {
      map['snapshot'] = Variable<String>(snapshot.value);
    }
    if (cartonEdits.present) {
      map['carton_edits'] = Variable<String>(cartonEdits.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ReceiptDraftsCompanion(')
          ..write('scope: $scope, ')
          ..write('orderId: $orderId, ')
          ..write('draftId: $draftId, ')
          ..write('snapshot: $snapshot, ')
          ..write('cartonEdits: $cartonEdits, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$WorkerDatabase extends GeneratedDatabase {
  _$WorkerDatabase(QueryExecutor e) : super(e);
  $WorkerDatabaseManager get managers => $WorkerDatabaseManager(this);
  late final $CachedOrdersTable cachedOrders = $CachedOrdersTable(this);
  late final $ReceiptDraftsTable receiptDrafts = $ReceiptDraftsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    cachedOrders,
    receiptDrafts,
  ];
}

typedef $$CachedOrdersTableCreateCompanionBuilder =
    CachedOrdersCompanion Function({
      required String scope,
      required String orderId,
      required String snapshot,
      required int position,
      Value<int> rowid,
    });
typedef $$CachedOrdersTableUpdateCompanionBuilder =
    CachedOrdersCompanion Function({
      Value<String> scope,
      Value<String> orderId,
      Value<String> snapshot,
      Value<int> position,
      Value<int> rowid,
    });

class $$CachedOrdersTableFilterComposer
    extends Composer<_$WorkerDatabase, $CachedOrdersTable> {
  $$CachedOrdersTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get scope => $composableBuilder(
    column: $table.scope,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get orderId => $composableBuilder(
    column: $table.orderId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get snapshot => $composableBuilder(
    column: $table.snapshot,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get position => $composableBuilder(
    column: $table.position,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedOrdersTableOrderingComposer
    extends Composer<_$WorkerDatabase, $CachedOrdersTable> {
  $$CachedOrdersTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get scope => $composableBuilder(
    column: $table.scope,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get orderId => $composableBuilder(
    column: $table.orderId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get snapshot => $composableBuilder(
    column: $table.snapshot,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get position => $composableBuilder(
    column: $table.position,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedOrdersTableAnnotationComposer
    extends Composer<_$WorkerDatabase, $CachedOrdersTable> {
  $$CachedOrdersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get scope =>
      $composableBuilder(column: $table.scope, builder: (column) => column);

  GeneratedColumn<String> get orderId =>
      $composableBuilder(column: $table.orderId, builder: (column) => column);

  GeneratedColumn<String> get snapshot =>
      $composableBuilder(column: $table.snapshot, builder: (column) => column);

  GeneratedColumn<int> get position =>
      $composableBuilder(column: $table.position, builder: (column) => column);
}

class $$CachedOrdersTableTableManager
    extends
        RootTableManager<
          _$WorkerDatabase,
          $CachedOrdersTable,
          CachedOrderRow,
          $$CachedOrdersTableFilterComposer,
          $$CachedOrdersTableOrderingComposer,
          $$CachedOrdersTableAnnotationComposer,
          $$CachedOrdersTableCreateCompanionBuilder,
          $$CachedOrdersTableUpdateCompanionBuilder,
          (
            CachedOrderRow,
            BaseReferences<
              _$WorkerDatabase,
              $CachedOrdersTable,
              CachedOrderRow
            >,
          ),
          CachedOrderRow,
          PrefetchHooks Function()
        > {
  $$CachedOrdersTableTableManager(_$WorkerDatabase db, $CachedOrdersTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedOrdersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedOrdersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedOrdersTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> scope = const Value.absent(),
                Value<String> orderId = const Value.absent(),
                Value<String> snapshot = const Value.absent(),
                Value<int> position = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedOrdersCompanion(
                scope: scope,
                orderId: orderId,
                snapshot: snapshot,
                position: position,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String scope,
                required String orderId,
                required String snapshot,
                required int position,
                Value<int> rowid = const Value.absent(),
              }) => CachedOrdersCompanion.insert(
                scope: scope,
                orderId: orderId,
                snapshot: snapshot,
                position: position,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedOrdersTable, CachedOrderRow>(table),
                  BaseReferences<
                    _$WorkerDatabase,
                    $CachedOrdersTable,
                    CachedOrderRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedOrdersTableProcessedTableManager =
    ProcessedTableManager<
      _$WorkerDatabase,
      $CachedOrdersTable,
      CachedOrderRow,
      $$CachedOrdersTableFilterComposer,
      $$CachedOrdersTableOrderingComposer,
      $$CachedOrdersTableAnnotationComposer,
      $$CachedOrdersTableCreateCompanionBuilder,
      $$CachedOrdersTableUpdateCompanionBuilder,
      (
        CachedOrderRow,
        BaseReferences<_$WorkerDatabase, $CachedOrdersTable, CachedOrderRow>,
      ),
      CachedOrderRow,
      PrefetchHooks Function()
    >;
typedef $$ReceiptDraftsTableCreateCompanionBuilder =
    ReceiptDraftsCompanion Function({
      required String scope,
      required String orderId,
      required String draftId,
      required String snapshot,
      required String cartonEdits,
      Value<int> rowid,
    });
typedef $$ReceiptDraftsTableUpdateCompanionBuilder =
    ReceiptDraftsCompanion Function({
      Value<String> scope,
      Value<String> orderId,
      Value<String> draftId,
      Value<String> snapshot,
      Value<String> cartonEdits,
      Value<int> rowid,
    });

class $$ReceiptDraftsTableFilterComposer
    extends Composer<_$WorkerDatabase, $ReceiptDraftsTable> {
  $$ReceiptDraftsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get scope => $composableBuilder(
    column: $table.scope,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get orderId => $composableBuilder(
    column: $table.orderId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get draftId => $composableBuilder(
    column: $table.draftId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get snapshot => $composableBuilder(
    column: $table.snapshot,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cartonEdits => $composableBuilder(
    column: $table.cartonEdits,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ReceiptDraftsTableOrderingComposer
    extends Composer<_$WorkerDatabase, $ReceiptDraftsTable> {
  $$ReceiptDraftsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get scope => $composableBuilder(
    column: $table.scope,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get orderId => $composableBuilder(
    column: $table.orderId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get draftId => $composableBuilder(
    column: $table.draftId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get snapshot => $composableBuilder(
    column: $table.snapshot,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cartonEdits => $composableBuilder(
    column: $table.cartonEdits,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ReceiptDraftsTableAnnotationComposer
    extends Composer<_$WorkerDatabase, $ReceiptDraftsTable> {
  $$ReceiptDraftsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get scope =>
      $composableBuilder(column: $table.scope, builder: (column) => column);

  GeneratedColumn<String> get orderId =>
      $composableBuilder(column: $table.orderId, builder: (column) => column);

  GeneratedColumn<String> get draftId =>
      $composableBuilder(column: $table.draftId, builder: (column) => column);

  GeneratedColumn<String> get snapshot =>
      $composableBuilder(column: $table.snapshot, builder: (column) => column);

  GeneratedColumn<String> get cartonEdits => $composableBuilder(
    column: $table.cartonEdits,
    builder: (column) => column,
  );
}

class $$ReceiptDraftsTableTableManager
    extends
        RootTableManager<
          _$WorkerDatabase,
          $ReceiptDraftsTable,
          ReceiptDraftRow,
          $$ReceiptDraftsTableFilterComposer,
          $$ReceiptDraftsTableOrderingComposer,
          $$ReceiptDraftsTableAnnotationComposer,
          $$ReceiptDraftsTableCreateCompanionBuilder,
          $$ReceiptDraftsTableUpdateCompanionBuilder,
          (
            ReceiptDraftRow,
            BaseReferences<
              _$WorkerDatabase,
              $ReceiptDraftsTable,
              ReceiptDraftRow
            >,
          ),
          ReceiptDraftRow,
          PrefetchHooks Function()
        > {
  $$ReceiptDraftsTableTableManager(
    _$WorkerDatabase db,
    $ReceiptDraftsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ReceiptDraftsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ReceiptDraftsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ReceiptDraftsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> scope = const Value.absent(),
                Value<String> orderId = const Value.absent(),
                Value<String> draftId = const Value.absent(),
                Value<String> snapshot = const Value.absent(),
                Value<String> cartonEdits = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ReceiptDraftsCompanion(
                scope: scope,
                orderId: orderId,
                draftId: draftId,
                snapshot: snapshot,
                cartonEdits: cartonEdits,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String scope,
                required String orderId,
                required String draftId,
                required String snapshot,
                required String cartonEdits,
                Value<int> rowid = const Value.absent(),
              }) => ReceiptDraftsCompanion.insert(
                scope: scope,
                orderId: orderId,
                draftId: draftId,
                snapshot: snapshot,
                cartonEdits: cartonEdits,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$ReceiptDraftsTable, ReceiptDraftRow>(table),
                  BaseReferences<
                    _$WorkerDatabase,
                    $ReceiptDraftsTable,
                    ReceiptDraftRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ReceiptDraftsTableProcessedTableManager =
    ProcessedTableManager<
      _$WorkerDatabase,
      $ReceiptDraftsTable,
      ReceiptDraftRow,
      $$ReceiptDraftsTableFilterComposer,
      $$ReceiptDraftsTableOrderingComposer,
      $$ReceiptDraftsTableAnnotationComposer,
      $$ReceiptDraftsTableCreateCompanionBuilder,
      $$ReceiptDraftsTableUpdateCompanionBuilder,
      (
        ReceiptDraftRow,
        BaseReferences<_$WorkerDatabase, $ReceiptDraftsTable, ReceiptDraftRow>,
      ),
      ReceiptDraftRow,
      PrefetchHooks Function()
    >;

class $WorkerDatabaseManager {
  final _$WorkerDatabase _db;
  $WorkerDatabaseManager(this._db);
  $$CachedOrdersTableTableManager get cachedOrders =>
      $$CachedOrdersTableTableManager(_db, _db.cachedOrders);
  $$ReceiptDraftsTableTableManager get receiptDrafts =>
      $$ReceiptDraftsTableTableManager(_db, _db.receiptDrafts);
}
