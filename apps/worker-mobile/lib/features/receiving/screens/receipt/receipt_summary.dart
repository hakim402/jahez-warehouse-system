import 'package:flutter/material.dart';

import '../../../../app/worker_theme.dart';
import '../../../../l10n/generated/worker_strings.dart';
import '../../../../offline/receiving_receipt.dart';
import 'receipt_measurements_screen.dart';

class ReceivingStage extends StatelessWidget {
  const ReceivingStage(this.step, {super.key});

  final int step;

  @override
  Widget build(BuildContext context) => Row(
    spacing: 4,
    children: [
      for (var stage = 1; stage <= 3; stage++)
        Container(
          width: 18,
          height: 5,
          decoration: BoxDecoration(
            color: stage == step ? JahezColors.deep : JahezColors.border,
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      const SizedBox(width: 4),
      Expanded(child: Text(WorkerStrings.of(context).receivingStage(step))),
    ],
  );
}

class ReceiptSummary extends StatelessWidget {
  const ReceiptSummary({super.key, required this.lines});

  final List<ReceiptDeliveryLine> lines;

  @override
  Widget build(BuildContext context) {
    final strings = WorkerStrings.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final missing = _sum((line) => line.missing);
    final extra = _sum((line) => line.extra);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          color: JahezColors.lavender,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(strings.cartonSummary, style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                _quantity(
                  context,
                  strings.dueCartons,
                  _sum((line) => line.due),
                ),
                _quantity(
                  context,
                  strings.arrivedCartons,
                  _sum((line) => line.cartons),
                ),
                if (missing > 0)
                  _quantity(context, strings.missingCartons, missing),
                if (extra > 0) _quantity(context, strings.extraCartons, extra),
              ],
            ),
          ),
        ),
        for (final (index, line) in lines.indexed) ...[
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    line.orderLine.nameFor(locale) ??
                        strings.itemProgress(index + 1, lines.length),
                    style: theme.textTheme.titleMedium,
                  ),
                  _quantity(context, strings.dueCartons, line.due),
                  _quantity(context, strings.arrivedCartons, line.cartons),
                  if (line.missing > 0)
                    _quantity(context, strings.missingCartons, line.missing),
                  if (line.extra > 0)
                    _quantity(context, strings.extraCartons, line.extra),
                  if (line.cartons > 0) ...[
                    if (line.details.damaged) Text(strings.damagedGoods),
                    ..._measurements(context, line),
                  ],
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  int _sum(int Function(ReceiptDeliveryLine) value) =>
      lines.fold(0, (total, line) => total + value(line));

  Widget _quantity(BuildContext context, String label, int value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        const SizedBox(width: 12),
        Text(receiptNumber(context, value)),
      ],
    ),
  );

  List<Widget> _measurements(BuildContext context, ReceiptDeliveryLine line) {
    final strings = WorkerStrings.of(context);
    final measurements = line.details.measurements;
    final cbm = measurements.cbm(line.cartons);
    return [
      if (cbm != null) ...[
        Text(
          strings.cartonSizeValue(
            receiptNumber(context, measurements.lengthCm!),
            receiptNumber(context, measurements.widthCm!),
            receiptNumber(context, measurements.heightCm!),
          ),
        ),
        Text(strings.cbmValue(receiptNumber(context, cbm))),
      ],
      if (measurements.weightKg case final weight?)
        Text(strings.weightValue(receiptNumber(context, weight))),
    ];
  }
}
