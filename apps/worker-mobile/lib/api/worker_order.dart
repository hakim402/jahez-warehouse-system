class WorkerOrder {
  WorkerOrder.fromJson(Map<String, Object?> json)
    : id = _requiredText(json['id']),
      number = _requiredText(json['orderNo']),
      status = json['status'] == 'partly_received'
          ? ReceivingOrderStatus.partlyReceived
          : json['status'] == 'ready'
          ? ReceivingOrderStatus.ready
          : throw const FormatException('Invalid receiving order status'),
      supplier = _requiredText((json['supplier'] as Map)['name']),
      supplierChinese = (json['supplier'] as Map)['nameCn'] as String?,
      shippingMark = (json['customer'] as Map)['shippingMark'] as String?,
      expectedCartons = _cartons(json['expectedCartons']),
      remainingCartons = _cartons(json['remainingCartons']),
      lines = List.unmodifiable(
        (json['lines'] as List).map(
          (line) => WorkerOrderLine.fromJson(line as Map<String, Object?>),
        ),
      ) {
    if (lines.isEmpty ||
        lines.map((line) => line.id).toSet().length != lines.length) {
      throw const FormatException('Invalid receiving order lines');
    }
  }

  final String id;
  final String number;
  final ReceivingOrderStatus status;
  final String supplier;
  final String? supplierChinese;
  final String? shippingMark;
  final int expectedCartons;
  final int remainingCartons;
  final List<WorkerOrderLine> lines;

  String supplierFor(String language) =>
      language == 'zh' && supplierChinese?.isNotEmpty == true
      ? supplierChinese!
      : supplier;

  Map<String, Object?> toJson() => {
    'id': id,
    'orderNo': number,
    'status': status == ReceivingOrderStatus.ready
        ? 'ready'
        : 'partly_received',
    'supplier': {'name': supplier, 'nameCn': supplierChinese},
    'customer': {'shippingMark': shippingMark},
    'expectedCartons': expectedCartons,
    'remainingCartons': remainingCartons,
    'lines': lines.map((line) => line.toJson()).toList(),
  };
}

enum ReceivingOrderStatus { ready, partlyReceived }

class WorkerOrderLine {
  WorkerOrderLine.fromJson(Map<String, Object?> json)
    : id = _requiredText(json['id']),
      remainingCartons = _cartons(json['remainingCartons']),
      nameAr = (json['product'] as Map)['nameAr'] as String?,
      nameEn = (json['product'] as Map)['nameEn'] as String?,
      nameCn = (json['product'] as Map)['nameCn'] as String?,
      modelNumber = (json['product'] as Map)['modelNo'] as String?;

  final String id;
  final int remainingCartons;
  final String? nameAr;
  final String? nameEn;
  final String? nameCn;
  final String? modelNumber;

  String? nameFor(String language) {
    final preferred = switch (language) {
      'ar' => nameAr,
      'zh' => nameCn,
      _ => nameEn,
    };
    return [
      preferred,
      nameEn,
      nameCn,
      nameAr,
      modelNumber,
    ].whereType<String>().where((name) => name.trim().isNotEmpty).firstOrNull;
  }

  Map<String, Object?> toJson() => {
    'id': id,
    'remainingCartons': remainingCartons,
    'product': {
      'nameAr': nameAr,
      'nameEn': nameEn,
      'nameCn': nameCn,
      'modelNo': modelNumber,
    },
  };
}

String _requiredText(Object? value) {
  if (value is! String || value.trim().isEmpty) {
    throw const FormatException('Missing receiving order field');
  }
  return value;
}

int _cartons(Object? value) {
  if (value is! int || value < 0) {
    throw const FormatException('Invalid carton quantity');
  }
  return value;
}
