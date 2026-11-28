import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../api/worker_order.dart';
import '../../../../app/worker_theme.dart';
import '../../../../l10n/generated/worker_strings.dart';
import '../../../../offline/receiving_store.dart';

class ReceiptDraftScreen extends StatefulWidget {
  const ReceiptDraftScreen({
    super.key,
    required this.order,
    required this.draft,
    required this.onSave,
    required this.onDone,
  });

  final WorkerOrder order;
  final ReceiptDraft? draft;
  final Future<ReceiptDraft?> Function(WorkerOrderLine, int) onSave;
  final VoidCallback onDone;

  @override
  State<ReceiptDraftScreen> createState() => _ReceiptDraftScreenState();
}

class _ReceiptDraftScreenState extends State<ReceiptDraftScreen> {
  static const _maximumCartons = 2147483647;
  late ReceiptDraft? _draft = widget.draft;
  var _index = 0;
  var _saving = false;
  var _failed = false;

  Future<void> _save(WorkerOrderLine line, int cartons) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      final saved = await widget.onSave(line, cartons);
      if (mounted && saved != null) setState(() => _draft = saved);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _edit(WorkerOrderLine line, int cartons) async {
    final updated = await showDialog<int>(
      context: context,
      builder: (_) => _CartonDialog(initial: cartons),
    );
    if (mounted && updated != null) await _save(line, updated);
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final strings = WorkerStrings.of(context);
    final line = order.lines[_index];
    final cartons = _draft?.cartons[line.id] ?? line.remainingCartons;
    final hasNext = _index + 1 < order.lines.length;
    final locale = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          strings.itemProgress(_index + 1, order.lines.length),
          style: theme.textTheme.labelLarge,
        ),
        const SizedBox(height: 8),
        Text([order.supplierFor(locale), ?order.shippingMark].join(' · ')),
        const SizedBox(height: 12),
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
                  child: Text('$cartons'),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filledTonal(
              tooltip: strings.increaseCartons,
              onPressed: _saving || cartons >= _maximumCartons
                  ? null
                  : () => _save(line, cartons + 1),
              icon: const Icon(Icons.add),
            ),
          ],
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
          onPressed: _saving
              ? null
              : hasNext
              ? () => setState(() => _index++)
              : widget.onDone,
          child: Text(hasNext ? strings.nextItem : strings.done),
        ),
        if (_index > 0)
          TextButton(
            onPressed: _saving ? null : () => setState(() => _index--),
            child: Text(MaterialLocalizations.of(context).backButtonTooltip),
          ),
      ],
    );
  }
}

class _CartonDialog extends StatefulWidget {
  const _CartonDialog({required this.initial});
  final int initial;

  @override
  State<_CartonDialog> createState() => _CartonDialogState();
}

class _CartonDialogState extends State<_CartonDialog> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _value = TextEditingController(
    text: '${widget.initial}',
  );

  int? _parse() {
    final digits = _value.text.trim().replaceAllMapped(RegExp('[٠-٩۰-۹]'), (
      match,
    ) {
      final point = match[0]!.codeUnitAt(0);
      return '${point - (point >= 0x06f0 ? 0x06f0 : 0x0660)}';
    });
    final value = RegExp(r'^[0-9]+$').hasMatch(digits)
        ? int.tryParse(digits)
        : null;
    return value != null && value <= _ReceiptDraftScreenState._maximumCartons
        ? value
        : null;
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
          validator: (_) => _parse() == null ? strings.wholeCartons : null,
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
