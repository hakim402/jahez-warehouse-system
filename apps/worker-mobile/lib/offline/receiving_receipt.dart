import '../api/worker_order.dart';

class ReceiptMeasurements {
  const ReceiptMeasurements({
    this.lengthCm,
    this.widthCm,
    this.heightCm,
    this.weightKg,
  });

  ReceiptMeasurements.fromJson(Map<String, Object?> json)
    : lengthCm = (json['lengthCm'] as num?)?.toDouble(),
      widthCm = (json['widthCm'] as num?)?.toDouble(),
      heightCm = (json['heightCm'] as num?)?.toDouble(),
      weightKg = (json['weightKg'] as num?)?.toDouble();

  static const dimensionLimit = 100000000.0;
  static const weightLimit = 1000000000.0;
  static const volumeLimit = 1000000.0;

  final double? lengthCm;
  final double? widthCm;
  final double? heightCm;
  final double? weightKg;

  double? cbm(int cartons) {
    final length = lengthCm;
    final width = widthCm;
    final height = heightCm;
    if (length == null || width == null || height == null) return null;
    return double.parse(
      (length * width * height / 1000000 * cartons).toStringAsFixed(6),
    );
  }

  bool get dimensionsComplete =>
      (lengthCm == null && widthCm == null && heightCm == null) ||
      (lengthCm != null && widthCm != null && heightCm != null);

  bool get isValid =>
      dimensionsComplete &&
      [lengthCm, widthCm, heightCm].whereType<double>().every(
        (value) => value > 0 && value < dimensionLimit,
      ) &&
      (weightKg == null || (weightKg! > 0 && weightKg! < weightLimit));

  bool fits(int cartons) => isValid && (cbm(cartons) ?? 0) < volumeLimit;

  Map<String, Object?> toJson() => {
    if (lengthCm != null) 'lengthCm': lengthCm,
    if (widthCm != null) 'widthCm': widthCm,
    if (heightCm != null) 'heightCm': heightCm,
    if (weightKg != null) 'weightKg': weightKg,
  };
}

class ReceiptLineDetails {
  const ReceiptLineDetails({
    this.measurements = const ReceiptMeasurements(),
    this.damaged = false,
  });

  ReceiptLineDetails.fromJson(Map<String, Object?> json)
    : measurements = ReceiptMeasurements.fromJson(json),
      damaged = json['condition'] == 'damaged';

  final ReceiptMeasurements measurements;
  final bool damaged;

  Map<String, Object?> toJson() => {
    ...measurements.toJson(),
    'condition': damaged ? 'damaged' : 'ok',
  };
}

class ReceiptDraft {
  const ReceiptDraft(
    this.id,
    this.order,
    this.cartons, {
    this.details = const {},
  });

  final String id;
  final WorkerOrder order;
  final Map<String, int> cartons;
  final Map<String, ReceiptLineDetails> details;

  List<ReceiptDeliveryLine> get delivery => [
    for (final line in order.lines)
      ReceiptDeliveryLine(
        line,
        cartons[line.id] ?? line.remainingCartons,
        details[line.id] ?? const ReceiptLineDetails(),
      ),
  ];
}

class ReceiptDeliveryLine {
  const ReceiptDeliveryLine(this.orderLine, this.cartons, this.details);

  final WorkerOrderLine orderLine;
  final int cartons;
  final ReceiptLineDetails details;

  int get due => orderLine.remainingCartons;
  int get missing => cartons < due ? due - cartons : 0;
  int get extra => cartons > due ? cartons - due : 0;

  bool get isValid =>
      cartons >= 0 &&
      cartons <= orderLine.maximumReceiptCartons &&
      (cartons == 0 || details.measurements.fits(cartons));

  Map<String, Object?> toJson() => {
    'orderLineId': orderLine.id,
    'cartons': cartons,
    ...details.toJson(),
  };
}

class LocalReceipt {
  const LocalReceipt(this.order, this.payload);

  final WorkerOrder order;
  final Map<String, Object?> payload;

  String get operationId => payload['clientOperationId'] as String;
  String get reference => 'LOCAL-${operationId.split('-').first.toUpperCase()}';

  List<ReceiptDeliveryLine> get delivery {
    final delivered = {
      for (final line
          in (payload['lines'] as List).cast<Map<String, Object?>>())
        line['orderLineId'] as String: line,
    };
    return [
      for (final line in order.lines)
        ReceiptDeliveryLine(
          line,
          delivered[line.id]?['cartons'] as int? ?? 0,
          ReceiptLineDetails.fromJson(delivered[line.id] ?? const {}),
        ),
    ];
  }
}
