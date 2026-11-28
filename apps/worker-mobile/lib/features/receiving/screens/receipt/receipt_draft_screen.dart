import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../api/worker_order.dart';
import '../../../../app/worker_theme.dart';
import '../../../../l10n/generated/worker_strings.dart';
import '../../../../offline/receiving_receipt.dart';
import 'receipt_measurements_screen.dart';
import 'receipt_summary.dart';

class ReceiptDraftScreen extends StatefulWidget {
  const ReceiptDraftScreen({
    super.key,
    required this.order,
    required this.draft,
    required this.confirmed,
    required this.onSave,
    required this.onSaveDetails,
    required this.onConfirm,
    required this.onDone,
  });

  final WorkerOrder order;
  final ReceiptDraft? draft;
  final LocalReceipt? confirmed;
  final Future<ReceiptDraft?> Function(WorkerOrderLine, ReceiptLineDetails)
  onSaveDetails;
  final Future<LocalReceipt?> Function() onConfirm;
  final Future<ReceiptDraft?> Function(WorkerOrderLine, int) onSave;
  final VoidCallback onDone;

  @override
  State<ReceiptDraftScreen> createState() => _ReceiptDraftScreenState();
}

class _ReceiptDraftScreenState extends State<ReceiptDraftScreen> {
  late ReceiptDraft? _draft = widget.draft;
  late LocalReceipt? _confirmed = widget.confirmed;
  var _reviewing = false;
  var _index = 0;
  var _saving = false;
  var _failed = false;

  Future<void> _persist(Future<void> Function() operation) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      await operation();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _save(WorkerOrderLine line, int cartons) => _persist(() async {
    final saved = await widget.onSave(line, cartons);
    if (mounted && saved != null) setState(() => _draft = saved);
  });

  Future<void> _saveDetails(WorkerOrderLine line, ReceiptLineDetails details) =>
      _persist(() async {
        final saved = await widget.onSaveDetails(line, details);
        if (mounted && saved != null) setState(() => _draft = saved);
      });

  Future<void> _confirm() => _persist(() async {
    final saved = await widget.onConfirm();
    if (mounted && saved != null) setState(() => _confirmed = saved);
  });

  Future<void> _editMeasurements(ReceiptDeliveryLine delivery) async {
    final line = delivery.orderLine;
    final updated = await Navigator.of(context).push<ReceiptMeasurements>(
      MaterialPageRoute(
        builder: (context) => ReceiptMeasurementsScreen(
          itemName:
              line.nameFor(Localizations.localeOf(context).languageCode) ??
              WorkerStrings.of(context).checkGoods,
          cartons: delivery.cartons,
          initial: delivery.details.measurements,
        ),
      ),
    );
    if (mounted && updated != null) {
      await _saveDetails(
        line,
        ReceiptLineDetails(
          measurements: updated,
          damaged: delivery.details.damaged,
        ),
      );
    }
  }

  Future<void> _editDamage(ReceiptDeliveryLine delivery) async {
    var damaged = delivery.details.damaged;
    final updated = await showDialog<bool>(
      context: context,
      builder: (context) {
        final strings = WorkerStrings.of(context);
        return StatefulBuilder(
          builder: (context, update) => AlertDialog(
            title: Text(strings.reportProblem),
            content: CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(strings.damagedGoods),
              value: damaged,
              onChanged: (value) => update(() => damaged = value!),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(strings.cancel),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, damaged),
                child: Text(strings.saveProblem),
              ),
            ],
          ),
        );
      },
    );
    if (mounted && updated != null) {
      await _saveDetails(
        delivery.orderLine,
        ReceiptLineDetails(
          measurements: delivery.details.measurements,
          damaged: updated,
        ),
      );
    }
  }

  Future<void> _edit(WorkerOrderLine line, int cartons) async {
    final updated = await showDialog<int>(
      context: context,
      builder: (_) =>
          _CartonDialog(initial: cartons, maximum: line.maximumReceiptCartons),
    );
    if (mounted && updated != null) await _save(line, updated);
  }

  @override
  Widget build(BuildContext context) {
    final draft = _draft ?? ReceiptDraft('', widget.order, const {});
    final confirmed = _confirmed;
    final order = confirmed?.order ?? draft.order;
    final strings = WorkerStrings.of(context);
    final lines = confirmed?.delivery ?? draft.delivery;
    final delivery = lines[_index];
    final line = delivery.orderLine;
    final cartons = delivery.cartons;
    final hasNext = _index + 1 < lines.length;
    final locale = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final orderLabel = [
      order.supplierFor(locale),
      ?order.shippingMark,
    ].join(' · ');
    if (confirmed != null) {
      return ListView(
        key: const ValueKey('savedReceipt'),
        padding: const EdgeInsets.all(20),
        children: [
          const Icon(
            Icons.cloud_download_outlined,
            size: 44,
            color: JahezColors.deep,
          ),
          const SizedBox(height: 12),
          Text(
            strings.localReceiptSaved,
            style: theme.textTheme.headlineMedium,
          ),
          Text(strings.receiptWaitingForSync),
          const SizedBox(height: 12),
          Text(orderLabel),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.receipt_long_outlined),
            title: Text(strings.temporaryReference),
            subtitle: Text(confirmed.reference),
          ),
          ReceiptSummary(lines: lines),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: widget.onDone,
            child: Text(strings.backToReceiving),
          ),
        ],
      );
    }
    if (_reviewing) return _review(context, lines, orderLabel);
    return ListView(
      key: ValueKey(_index),
      padding: const EdgeInsets.all(20),
      children: [
        const ReceivingStage(2),
        const SizedBox(height: 12),
        Text(strings.checkGoods, style: theme.textTheme.headlineMedium),
        const SizedBox(height: 4),
        Text(orderLabel),
        const SizedBox(height: 12),
        Text(
          strings.itemProgress(_index + 1, order.lines.length),
          style: theme.textTheme.labelLarge,
        ),
        const SizedBox(height: 8),
        Card(
          color: JahezColors.lavender,
          child: ListTile(
            leading: const Icon(
              Icons.inventory_2_outlined,
              color: JahezColors.deep,
            ),
            title: Text(
              line.nameFor(locale) ??
                  strings.itemProgress(_index + 1, order.lines.length),
            ),
            subtitle: Text(strings.remainingCartons(line.remainingCartons)),
          ),
        ),
        const SizedBox(height: 16),
        Text(strings.cartonsArrived, style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        Row(
          children: [
            IconButton.filledTonal(
              tooltip: strings.decreaseCartons,
              onPressed: _saving || cartons <= 0
                  ? null
                  : () => _save(line, cartons - 1),
              icon: const Icon(Icons.remove),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                onPressed: _saving ? null : () => _edit(line, cartons),
                child: Semantics(
                  label: strings.editCartons,
                  child: Text(receiptNumber(context, cartons)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filledTonal(
              tooltip: strings.increaseCartons,
              onPressed: _saving || cartons >= line.maximumReceiptCartons
                  ? null
                  : () => _save(line, cartons + 1),
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Card(
          child: ListTile(
            leading: const Icon(Icons.straighten_outlined),
            title: Text(strings.sizeAndWeight),
            trailing: const Icon(Icons.chevron_right),
            onTap: _saving || cartons == 0
                ? null
                : () => _editMeasurements(delivery),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.warning_amber_rounded),
            title: Text(strings.reportProblem),
            subtitle: delivery.details.damaged && cartons > 0
                ? Text(strings.damagedGoods)
                : null,
            trailing: const Icon(Icons.chevron_right),
            onTap: _saving || cartons == 0 ? null : () => _editDamage(delivery),
          ),
        ),
        if (_saving) const LinearProgressIndicator(),
        if (_failed || _draft != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              _failed ? strings.draftStorageError : strings.savedDraft,
              textAlign: TextAlign.center,
            ),
          ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _saving || _failed
              ? null
              : hasNext
              ? () => setState(() => _index++)
              : () => setState(() => _reviewing = true),
          child: Text(hasNext ? strings.nextItem : strings.reviewReceipt),
        ),
        if (_index > 0)
          TextButton(
            onPressed: _saving ? null : () => setState(() => _index--),
            child: Text(MaterialLocalizations.of(context).backButtonTooltip),
          ),
      ],
    );
  }

  Widget _review(
    BuildContext context,
    List<ReceiptDeliveryLine> lines,
    String orderLabel,
  ) {
    final strings = WorkerStrings.of(context);
    final error = lines.every((line) => line.cartons == 0)
        ? strings.noCartonsToConfirm
        : lines.any((line) => !line.isValid)
        ? strings.invalidReceipt
        : null;
    return ListView(
      key: const ValueKey('receiptReview'),
      padding: const EdgeInsets.all(20),
      children: [
        const ReceivingStage(3),
        const SizedBox(height: 12),
        Text(
          strings.reviewReceipt,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        Text(orderLabel),
        const SizedBox(height: 12),
        ReceiptSummary(lines: lines),
        if (_saving) const LinearProgressIndicator(),
        if (_failed || error != null)
          Text(_failed ? strings.receiptSaveFailed : error!),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _saving || error != null ? null : _confirm,
          child: Text(strings.confirmReceipt),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _saving
              ? null
              : () => setState(() {
                  _failed = false;
                  _index = 0;
                  _reviewing = false;
                }),
          child: Text(strings.editItems),
        ),
      ],
    );
  }
}

class _CartonDialog extends StatefulWidget {
  const _CartonDialog({required this.initial, required this.maximum});
  final int initial;
  final int maximum;

  @override
  State<_CartonDialog> createState() => _CartonDialogState();
}

class _CartonDialogState extends State<_CartonDialog> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _value = TextEditingController(
    text: '${widget.initial}',
  );

  int? _parse() {
    final digits = asciiReceivingDigits(_value.text.trim());
    final value = RegExp(r'^[0-9]+$').hasMatch(digits)
        ? int.tryParse(digits)
        : null;
    return value != null && value <= widget.maximum ? value : null;
  }

  void _submit() {
    if (_form.currentState!.validate()) Navigator.pop(context, _parse());
  }

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = WorkerStrings.of(context);
    return AlertDialog(
      title: Text(strings.editCartons),
      content: Form(
        key: _form,
        child: TextFormField(
          controller: _value,
          autofocus: true,
          inputFormatters: [LengthLimitingTextInputFormatter(10)],
          keyboardType: TextInputType.number,
          onFieldSubmitted: (_) => _submit(),
          validator: (_) => _parse() == null
              ? strings.wholeCartons(receiptNumber(context, widget.maximum))
              : null,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(strings.cancel),
        ),
        FilledButton(onPressed: _submit, child: Text(strings.save)),
      ],
    );
  }
}
