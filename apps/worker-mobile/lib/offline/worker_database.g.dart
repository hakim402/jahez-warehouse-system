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
  static const VerificationMeta _lineDetailsMeta = const VerificationMeta(
    'lineDetails',
  );
  @override
  late final GeneratedColumn<String> lineDetails = GeneratedColumn<String>(
    'line_details',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    scope,
    orderId,
    draftId,
    snapshot,
    cartonEdits,
    lineDetails,
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
    if (data.containsKey('line_details')) {
      context.handle(
        _lineDetailsMeta,
        lineDetails.isAcceptableOrUnknown(
          data['line_details']!,
          _lineDetailsMeta,
        ),
      );
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
      lineDetails: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}line_details'],
      ),
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
  final String? lineDetails;
  const ReceiptDraftRow({
    required this.scope,
    required this.orderId,
    required this.draftId,
    required this.snapshot,
    required this.cartonEdits,
    this.lineDetails,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['scope'] = Variable<String>(scope);
    map['order_id'] = Variable<String>(orderId);
    map['draft_id'] = Variable<String>(draftId);
    map['snapshot'] = Variable<String>(snapshot);
    map['carton_edits'] = Variable<String>(cartonEdits);
    if (!nullToAbsent || lineDetails != null) {
      map['line_details'] = Variable<String>(lineDetails);
    }
    return map;
  }

  ReceiptDraftsCompanion toCompanion(bool nullToAbsent) {
    return ReceiptDraftsCompanion(
      scope: Value(scope),
      orderId: Value(orderId),
      draftId: Value(draftId),
      snapshot: Value(snapshot),
      cartonEdits: Value(cartonEdits),
      lineDetails: lineDetails == null && nullToAbsent
          ? const Value.absent()
          : Value(lineDetails),
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
      lineDetails: serializer.fromJson<String?>(json['lineDetails']),
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
      'lineDetails': serializer.toJson<String?>(lineDetails),
    };
  }

  ReceiptDraftRow copyWith({
    String? scope,
    String? orderId,
    String? draftId,
    String? snapshot,
    String? cartonEdits,
    Value<String?> lineDetails = const Value.absent(),
  }) => ReceiptDraftRow(
    scope: scope ?? this.scope,
    orderId: orderId ?? this.orderId,
    draftId: draftId ?? this.draftId,
    snapshot: snapshot ?? this.snapshot,
    cartonEdits: cartonEdits ?? this.cartonEdits,
    lineDetails: lineDetails.present ? lineDetails.value : this.lineDetails,
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
      lineDetails: data.lineDetails.present
          ? data.lineDetails.value
          : this.lineDetails,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ReceiptDraftRow(')
          ..write('scope: $scope, ')
          ..write('orderId: $orderId, ')
          ..write('draftId: $draftId, ')
          ..write('snapshot: $snapshot, ')
          ..write('cartonEdits: $cartonEdits, ')
          ..write('lineDetails: $lineDetails')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(scope, orderId, draftId, snapshot, cartonEdits, lineDetails);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ReceiptDraftRow &&
          other.scope == this.scope &&
          other.orderId == this.orderId &&
          other.draftId == this.draftId &&
          other.snapshot == this.snapshot &&
          other.cartonEdits == this.cartonEdits &&
          other.lineDetails == this.lineDetails);
}

class ReceiptDraftsCompanion extends UpdateCompanion<ReceiptDraftRow> {
  final Value<String> scope;
  final Value<String> orderId;
  final Value<String> draftId;
  final Value<String> snapshot;
  final Value<String> cartonEdits;
  final Value<String?> lineDetails;
  final Value<int> rowid;
  const ReceiptDraftsCompanion({
    this.scope = const Value.absent(),
    this.orderId = const Value.absent(),
    this.draftId = const Value.absent(),
    this.snapshot = const Value.absent(),
    this.cartonEdits = const Value.absent(),
    this.lineDetails = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ReceiptDraftsCompanion.insert({
    required String scope,
    required String orderId,
    required String draftId,
    required String snapshot,
    required String cartonEdits,
    this.lineDetails = const Value.absent(),
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
    Expression<String>? lineDetails,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (scope != null) 'scope': scope,
      if (orderId != null) 'order_id': orderId,
      if (draftId != null) 'draft_id': draftId,
      if (snapshot != null) 'snapshot': snapshot,
      if (cartonEdits != null) 'carton_edits': cartonEdits,
      if (lineDetails != null) 'line_details': lineDetails,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ReceiptDraftsCompanion copyWith({
    Value<String>? scope,
    Value<String>? orderId,
    Value<String>? draftId,
    Value<String>? snapshot,
    Value<String>? cartonEdits,
    Value<String?>? lineDetails,
    Value<int>? rowid,
  }) {
    return ReceiptDraftsCompanion(
      scope: scope ?? this.scope,
      orderId: orderId ?? this.orderId,
      draftId: draftId ?? this.draftId,
      snapshot: snapshot ?? this.snapshot,
      cartonEdits: cartonEdits ?? this.cartonEdits,
      lineDetails: lineDetails ?? this.lineDetails,
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
    if (lineDetails.present) {
      map['line_details'] = Variable<String>(lineDetails.value);
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
          ..write('lineDetails: $lineDetails, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LocalReceiptsTable extends LocalReceipts
    with TableInfo<$LocalReceiptsTable, LocalReceiptRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalReceiptsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _ownerScopeMeta = const VerificationMeta(
    'ownerScope',
  );
  @override
  late final GeneratedColumn<String> ownerScope = GeneratedColumn<String>(
    'owner_scope',
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
  static const VerificationMeta _operationIdMeta = const VerificationMeta(
    'operationId',
  );
  @override
  late final GeneratedColumn<String> operationId = GeneratedColumn<String>(
    'operation_id',
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
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    ownerScope,
    orderId,
    operationId,
    snapshot,
    payload,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_receipts';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalReceiptRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('owner_scope')) {
      context.handle(
        _ownerScopeMeta,
        ownerScope.isAcceptableOrUnknown(data['owner_scope']!, _ownerScopeMeta),
      );
    } else if (isInserting) {
      context.missing(_ownerScopeMeta);
    }
    if (data.containsKey('order_id')) {
      context.handle(
        _orderIdMeta,
        orderId.isAcceptableOrUnknown(data['order_id']!, _orderIdMeta),
      );
    } else if (isInserting) {
      context.missing(_orderIdMeta);
    }
    if (data.containsKey('operation_id')) {
      context.handle(
        _operationIdMeta,
        operationId.isAcceptableOrUnknown(
          data['operation_id']!,
          _operationIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_operationIdMeta);
    }
    if (data.containsKey('snapshot')) {
      context.handle(
        _snapshotMeta,
        snapshot.isAcceptableOrUnknown(data['snapshot']!, _snapshotMeta),
      );
    } else if (isInserting) {
      context.missing(_snapshotMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {ownerScope, orderId};
  @override
  LocalReceiptRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalReceiptRow(
      ownerScope: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}owner_scope'],
      )!,
      orderId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}order_id'],
      )!,
      operationId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operation_id'],
      )!,
      snapshot: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}snapshot'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
    );
  }

  @override
  $LocalReceiptsTable createAlias(String alias) {
    return $LocalReceiptsTable(attachedDatabase, alias);
  }
}

class LocalReceiptRow extends DataClass implements Insertable<LocalReceiptRow> {
  final String ownerScope;
  final String orderId;
  final String operationId;
  final String snapshot;
  final String payload;
  const LocalReceiptRow({
    required this.ownerScope,
    required this.orderId,
    required this.operationId,
    required this.snapshot,
    required this.payload,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['owner_scope'] = Variable<String>(ownerScope);
    map['order_id'] = Variable<String>(orderId);
    map['operation_id'] = Variable<String>(operationId);
    map['snapshot'] = Variable<String>(snapshot);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  LocalReceiptsCompanion toCompanion(bool nullToAbsent) {
    return LocalReceiptsCompanion(
      ownerScope: Value(ownerScope),
      orderId: Value(orderId),
      operationId: Value(operationId),
      snapshot: Value(snapshot),
      payload: Value(payload),
    );
  }

  factory LocalReceiptRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalReceiptRow(
      ownerScope: serializer.fromJson<String>(json['ownerScope']),
      orderId: serializer.fromJson<String>(json['orderId']),
      operationId: serializer.fromJson<String>(json['operationId']),
      snapshot: serializer.fromJson<String>(json['snapshot']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'ownerScope': serializer.toJson<String>(ownerScope),
      'orderId': serializer.toJson<String>(orderId),
      'operationId': serializer.toJson<String>(operationId),
      'snapshot': serializer.toJson<String>(snapshot),
      'payload': serializer.toJson<String>(payload),
    };
  }

  LocalReceiptRow copyWith({
    String? ownerScope,
    String? orderId,
    String? operationId,
    String? snapshot,
    String? payload,
  }) => LocalReceiptRow(
    ownerScope: ownerScope ?? this.ownerScope,
    orderId: orderId ?? this.orderId,
    operationId: operationId ?? this.operationId,
    snapshot: snapshot ?? this.snapshot,
    payload: payload ?? this.payload,
  );
  LocalReceiptRow copyWithCompanion(LocalReceiptsCompanion data) {
    return LocalReceiptRow(
      ownerScope: data.ownerScope.present
          ? data.ownerScope.value
          : this.ownerScope,
      orderId: data.orderId.present ? data.orderId.value : this.orderId,
      operationId: data.operationId.present
          ? data.operationId.value
          : this.operationId,
      snapshot: data.snapshot.present ? data.snapshot.value : this.snapshot,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalReceiptRow(')
          ..write('ownerScope: $ownerScope, ')
          ..write('orderId: $orderId, ')
          ..write('operationId: $operationId, ')
          ..write('snapshot: $snapshot, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(ownerScope, orderId, operationId, snapshot, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalReceiptRow &&
          other.ownerScope == this.ownerScope &&
          other.orderId == this.orderId &&
          other.operationId == this.operationId &&
          other.snapshot == this.snapshot &&
          other.payload == this.payload);
}

class LocalReceiptsCompanion extends UpdateCompanion<LocalReceiptRow> {
  final Value<String> ownerScope;
  final Value<String> orderId;
  final Value<String> operationId;
  final Value<String> snapshot;
  final Value<String> payload;
  final Value<int> rowid;
  const LocalReceiptsCompanion({
    this.ownerScope = const Value.absent(),
    this.orderId = const Value.absent(),
    this.operationId = const Value.absent(),
    this.snapshot = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalReceiptsCompanion.insert({
    required String ownerScope,
    required String orderId,
    required String operationId,
    required String snapshot,
    required String payload,
    this.rowid = const Value.absent(),
  }) : ownerScope = Value(ownerScope),
       orderId = Value(orderId),
       operationId = Value(operationId),
       snapshot = Value(snapshot),
       payload = Value(payload);
  static Insertable<LocalReceiptRow> custom({
    Expression<String>? ownerScope,
    Expression<String>? orderId,
    Expression<String>? operationId,
    Expression<String>? snapshot,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (ownerScope != null) 'owner_scope': ownerScope,
      if (orderId != null) 'order_id': orderId,
      if (operationId != null) 'operation_id': operationId,
      if (snapshot != null) 'snapshot': snapshot,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalReceiptsCompanion copyWith({
    Value<String>? ownerScope,
    Value<String>? orderId,
    Value<String>? operationId,
    Value<String>? snapshot,
    Value<String>? payload,
    Value<int>? rowid,
  }) {
    return LocalReceiptsCompanion(
      ownerScope: ownerScope ?? this.ownerScope,
      orderId: orderId ?? this.orderId,
      operationId: operationId ?? this.operationId,
      snapshot: snapshot ?? this.snapshot,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (ownerScope.present) {
      map['owner_scope'] = Variable<String>(ownerScope.value);
    }
    if (orderId.present) {
      map['order_id'] = Variable<String>(orderId.value);
    }
    if (operationId.present) {
      map['operation_id'] = Variable<String>(operationId.value);
    }
    if (snapshot.present) {
      map['snapshot'] = Variable<String>(snapshot.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalReceiptsCompanion(')
          ..write('ownerScope: $ownerScope, ')
          ..write('orderId: $orderId, ')
          ..write('operationId: $operationId, ')
          ..write('snapshot: $snapshot, ')
          ..write('payload: $payload, ')
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
  late final $LocalReceiptsTable localReceipts = $LocalReceiptsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    cachedOrders,
    receiptDrafts,
    localReceipts,
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
      Value<String?> lineDetails,
      Value<int> rowid,
    });
typedef $$ReceiptDraftsTableUpdateCompanionBuilder =
    ReceiptDraftsCompanion Function({
      Value<String> scope,
      Value<String> orderId,
      Value<String> draftId,
      Value<String> snapshot,
      Value<String> cartonEdits,
      Value<String?> lineDetails,
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

  ColumnFilters<String> get lineDetails => $composableBuilder(
    column: $table.lineDetails,
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

  ColumnOrderings<String> get lineDetails => $composableBuilder(
    column: $table.lineDetails,
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

  GeneratedColumn<String> get lineDetails => $composableBuilder(
    column: $table.lineDetails,
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
                Value<String?> lineDetails = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ReceiptDraftsCompanion(
                scope: scope,
                orderId: orderId,
                draftId: draftId,
                snapshot: snapshot,
                cartonEdits: cartonEdits,
                lineDetails: lineDetails,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String scope,
                required String orderId,
                required String draftId,
                required String snapshot,
                required String cartonEdits,
                Value<String?> lineDetails = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ReceiptDraftsCompanion.insert(
                scope: scope,
                orderId: orderId,
                draftId: draftId,
                snapshot: snapshot,
                cartonEdits: cartonEdits,
                lineDetails: lineDetails,
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
typedef $$LocalReceiptsTableCreateCompanionBuilder =
    LocalReceiptsCompanion Function({
      required String ownerScope,
      required String orderId,
      required String operationId,
      required String snapshot,
      required String payload,
      Value<int> rowid,
    });
typedef $$LocalReceiptsTableUpdateCompanionBuilder =
    LocalReceiptsCompanion Function({
      Value<String> ownerScope,
      Value<String> orderId,
      Value<String> operationId,
      Value<String> snapshot,
      Value<String> payload,
      Value<int> rowid,
    });

class $$LocalReceiptsTableFilterComposer
    extends Composer<_$WorkerDatabase, $LocalReceiptsTable> {
  $$LocalReceiptsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get ownerScope => $composableBuilder(
    column: $table.ownerScope,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get orderId => $composableBuilder(
    column: $table.orderId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operationId => $composableBuilder(
    column: $table.operationId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get snapshot => $composableBuilder(
    column: $table.snapshot,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LocalReceiptsTableOrderingComposer
    extends Composer<_$WorkerDatabase, $LocalReceiptsTable> {
  $$LocalReceiptsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get ownerScope => $composableBuilder(
    column: $table.ownerScope,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get orderId => $composableBuilder(
    column: $table.orderId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operationId => $composableBuilder(
    column: $table.operationId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get snapshot => $composableBuilder(
    column: $table.snapshot,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LocalReceiptsTableAnnotationComposer
    extends Composer<_$WorkerDatabase, $LocalReceiptsTable> {
  $$LocalReceiptsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get ownerScope => $composableBuilder(
    column: $table.ownerScope,
    builder: (column) => column,
  );

  GeneratedColumn<String> get orderId =>
      $composableBuilder(column: $table.orderId, builder: (column) => column);

  GeneratedColumn<String> get operationId => $composableBuilder(
    column: $table.operationId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get snapshot =>
      $composableBuilder(column: $table.snapshot, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$LocalReceiptsTableTableManager
    extends
        RootTableManager<
          _$WorkerDatabase,
          $LocalReceiptsTable,
          LocalReceiptRow,
          $$LocalReceiptsTableFilterComposer,
          $$LocalReceiptsTableOrderingComposer,
          $$LocalReceiptsTableAnnotationComposer,
          $$LocalReceiptsTableCreateCompanionBuilder,
          $$LocalReceiptsTableUpdateCompanionBuilder,
          (
            LocalReceiptRow,
            BaseReferences<
              _$WorkerDatabase,
              $LocalReceiptsTable,
              LocalReceiptRow
            >,
          ),
          LocalReceiptRow,
          PrefetchHooks Function()
        > {
  $$LocalReceiptsTableTableManager(
    _$WorkerDatabase db,
    $LocalReceiptsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalReceiptsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalReceiptsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalReceiptsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> ownerScope = const Value.absent(),
                Value<String> orderId = const Value.absent(),
                Value<String> operationId = const Value.absent(),
                Value<String> snapshot = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalReceiptsCompanion(
                ownerScope: ownerScope,
                orderId: orderId,
                operationId: operationId,
                snapshot: snapshot,
                payload: payload,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String ownerScope,
                required String orderId,
                required String operationId,
                required String snapshot,
                required String payload,
                Value<int> rowid = const Value.absent(),
              }) => LocalReceiptsCompanion.insert(
                ownerScope: ownerScope,
                orderId: orderId,
                operationId: operationId,
                snapshot: snapshot,
                payload: payload,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$LocalReceiptsTable, LocalReceiptRow>(table),
                  BaseReferences<
                    _$WorkerDatabase,
                    $LocalReceiptsTable,
                    LocalReceiptRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocalReceiptsTableProcessedTableManager =
    ProcessedTableManager<
      _$WorkerDatabase,
      $LocalReceiptsTable,
      LocalReceiptRow,
      $$LocalReceiptsTableFilterComposer,
      $$LocalReceiptsTableOrderingComposer,
      $$LocalReceiptsTableAnnotationComposer,
      $$LocalReceiptsTableCreateCompanionBuilder,
      $$LocalReceiptsTableUpdateCompanionBuilder,
      (
        LocalReceiptRow,
        BaseReferences<_$WorkerDatabase, $LocalReceiptsTable, LocalReceiptRow>,
      ),
      LocalReceiptRow,
      PrefetchHooks Function()
    >;

class $WorkerDatabaseManager {
  final _$WorkerDatabase _db;
  $WorkerDatabaseManager(this._db);
  $$CachedOrdersTableTableManager get cachedOrders =>
      $$CachedOrdersTableTableManager(_db, _db.cachedOrders);
  $$ReceiptDraftsTableTableManager get receiptDrafts =>
      $$ReceiptDraftsTableTableManager(_db, _db.receiptDrafts);
  $$LocalReceiptsTableTableManager get localReceipts =>
      $$LocalReceiptsTableTableManager(_db, _db.localReceipts);
}
