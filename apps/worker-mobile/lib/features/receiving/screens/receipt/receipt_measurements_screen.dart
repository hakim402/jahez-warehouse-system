import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show NumberFormat;

import '../../../../l10n/generated/worker_strings.dart';
import '../../../../offline/receiving_receipt.dart';

class ReceiptMeasurementsScreen extends StatefulWidget {
  const ReceiptMeasurementsScreen({
    super.key,
    required this.itemName,
    required this.cartons,
    required this.initial,
  });

  final String itemName;
  final int cartons;
  final ReceiptMeasurements initial;

  @override
  State<ReceiptMeasurementsScreen> createState() =>
      _ReceiptMeasurementsScreenState();
}

class _ReceiptMeasurementsScreenState extends State<ReceiptMeasurementsScreen> {
  final _form = GlobalKey<FormState>();
  late final _length = _controller(widget.initial.lengthCm);
  late final _width = _controller(widget.initial.widthCm);
  late final _height = _controller(widget.initial.heightCm);
  late final _weight = _controller(widget.initial.weightKg);
  String? _error;

  TextEditingController _controller(double? value) => TextEditingController(
    text: value == null ? '' : NumberFormat('0.###', 'en').format(value),
  );

  double? _parse(TextEditingController controller, int scale) {
    final value = asciiReceivingDigits(
      controller.text.trim(),
    ).replaceAll(',', '.').replaceAll('٫', '.').replaceAll('．', '.');
    final pattern = RegExp('^[0-9]+(?:[.][0-9]{1,$scale})?\$');
    return pattern.hasMatch(value) ? double.tryParse(value) : null;
  }

  ReceiptMeasurements get _values => ReceiptMeasurements(
    lengthCm: _parse(_length, 2),
    widthCm: _parse(_width, 2),
    heightCm: _parse(_height, 2),
    weightKg: _parse(_weight, 3),
  );

  void _save(WorkerStrings strings) {
    if (!_form.currentState!.validate()) return;
    final values = _values;
    if (!values.dimensionsComplete) {
      setState(() => _error = strings.completeDimensions);
    } else if (!values.fits(widget.cartons)) {
      setState(() => _error = strings.volumeTooLarge);
    } else {
      Navigator.pop(context, values);
    }
  }

  @override
  void dispose() {
    for (final field in [_length, _width, _height, _weight]) {
      field.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = WorkerStrings.of(context);
    final theme = Theme.of(context);
    final cbm = _values.cbm(widget.cartons);
    return Scaffold(
      appBar: AppBar(title: Text(strings.sizeAndWeight)),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Text(widget.itemName, style: theme.textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(strings.measureCartonHelp),
                  const SizedBox(height: 20),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.cartonSize,
                            style: theme.textTheme.titleMedium,
                          ),
                          const SizedBox(height: 12),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            spacing: 8,
                            children: [
                              for (final (label, field) in [
                                (strings.cartonLength, _length),
                                (strings.cartonWidth, _width),
                                (strings.cartonHeight, _height),
                              ])
                                Expanded(
                                  child: _field(strings, label, field, 2),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _field(strings, strings.totalWeight, _weight, 3),
                  const SizedBox(height: 12),
                  ListTile(
                    title: Text(strings.calculatedVolume),
                    trailing: Text(
                      cbm == null
                          ? '–'
                          : strings.cbmValue(receiptNumber(context, cbm)),
                    ),
                  ),
                  if (_error case final error?)
                    Text(
                      error,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => _save(strings),
                    child: Text(strings.saveMeasurements),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(
    WorkerStrings strings,
    String label,
    TextEditingController controller,
    int scale,
  ) => TextFormField(
    controller: controller,
    textDirection: TextDirection.ltr,
    keyboardType: const TextInputType.numberWithOptions(decimal: true),
    decoration: InputDecoration(labelText: label, errorMaxLines: 3),
    onChanged: (_) => setState(() => _error = null),
    validator: (text) {
      if (text == null || text.trim().isEmpty) return null;
      final value = _parse(controller, scale);
      final limit = scale == 2
          ? ReceiptMeasurements.dimensionLimit
          : ReceiptMeasurements.weightLimit;
      return value == null || value <= 0 || value >= limit
          ? strings.measurementInvalid
          : null;
    },
  );
}

String receiptNumber(BuildContext context, num value) => NumberFormat(
  '0.######',
  Localizations.localeOf(context).toString(),
).format(value);

String asciiReceivingDigits(String value) =>
    value.replaceAllMapped(RegExp('[٠-٩۰-۹０-９]'), (match) {
      final point = match[0]!.codeUnitAt(0);
      final zero = point >= 0xff10
          ? 0xff10
          : point >= 0x06f0
          ? 0x06f0
          : 0x0660;
      return '${point - zero}';
    });
