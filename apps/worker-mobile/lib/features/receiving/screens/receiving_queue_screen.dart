import 'dart:async';

import 'package:flutter/material.dart';

import '../../../api/worker_order.dart';
import '../../../app/worker_theme.dart';
import '../../../l10n/generated/worker_strings.dart';
import '../../../offline/receiving_store.dart';
import '../receiving_repository.dart';
import 'receipt/receipt_draft_screen.dart';
import 'receipt/receipt_summary.dart';

class ReceivingQueueScreen extends StatefulWidget {
  const ReceivingQueueScreen({
    super.key,
    required this.repository,
    required this.warehouseName,
  });

  final ReceivingRepository repository;
  final String warehouseName;

  @override
  State<ReceivingQueueScreen> createState() => _ReceivingQueueScreenState();
}

class _ReceivingQueueScreenState extends State<ReceivingQueueScreen> {
  CachedReceiving _data = const CachedReceiving([], {});
  bool _refreshing = true;
  bool _refreshFailed = false;
  bool _storageFailed = false;
  String _search = '';
  ReceivingOrderStatus? _filter;
  WorkerOrder? _selected;

  bool get _active => widget.repository.active;

  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
  }

  Future<void> _read() async {
    try {
      final stored = await widget.repository.read();
      if (mounted && _active) {
        setState(() {
          _data = stored;
          _storageFailed = false;
        });
      }
    } catch (_) {
      if (mounted && _active) setState(() => _storageFailed = true);
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _refreshing = true;
      _refreshFailed = false;
    });
    await _read();
    try {
      if (!mounted || !_active) return;
      await widget.repository.refresh(() => mounted);
      await _read();
    } catch (_) {
      if (mounted && _active) setState(() => _refreshFailed = true);
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _open(WorkerOrder order, bool split) async {
    if (split) {
      setState(() => _selected = order);
    } else {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (context) => Scaffold(
            appBar: AppBar(title: Text(WorkerStrings.of(context).receiving)),
            body: SafeArea(
              child: _editor(order, () => Navigator.of(context).pop()),
            ),
          ),
        ),
      );
      if (mounted) await _read();
    }
  }

  ReceiptDraftScreen _editor(
    WorkerOrder order,
    VoidCallback onDone,
  ) => ReceiptDraftScreen(
    key: ValueKey(order.id),
    order: order,
    draft: _data.drafts[order.id],
    confirmed: _data.receipts[order.id],
    onDone: onDone,
    onSave: (line, cartons) async {
      final draft = await widget.repository.saveCartons(order, line, cartons);
      if (mounted && draft != null) await _read();
      return draft;
    },
    onSaveDetails: (line, details) async {
      final draft = await widget.repository.saveDetails(order, line, details);
      if (mounted && draft != null) await _read();
      return draft;
    },
    onConfirm: () async {
      final receipt = await widget.repository.confirm(order);
      if (mounted && receipt != null) await _read();
      return receipt;
    },
  );

  @override
  Widget build(BuildContext context) {
    final strings = WorkerStrings.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(strings.receivingQueue),
        actions: [
          IconButton(
            tooltip: strings.retry,
            icon: const Icon(Icons.refresh),
            onPressed: _refreshing ? null : _refresh,
          ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final split = constraints.maxWidth >= 700;
            final selected = _selected;
            if (!split) return _queue(context, false);
            return Row(
              children: [
                Expanded(child: _queue(context, true)),
                const VerticalDivider(width: 1),
                Expanded(
                  child: selected == null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(strings.selectOrder),
                          ),
                        )
                      : _editor(
                          selected,
                          () => setState(() => _selected = null),
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _queue(BuildContext context, bool split) {
    final strings = WorkerStrings.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final query = _search.trim().toLowerCase();
    final byId = {for (final order in _data.orders) order.id: order};
    for (final draft in _data.drafts.values) {
      byId.putIfAbsent(draft.order.id, () => draft.order);
    }
    for (final receipt in _data.receipts.values) {
      byId.putIfAbsent(receipt.order.id, () => receipt.order);
    }
    final shown = byId.values.where((order) {
      return (_filter == null || _filter == order.status) &&
          [
            order.number,
            order.supplier,
            order.supplierChinese,
            order.shippingMark,
          ].whereType<String>().any(
            (value) => value.toLowerCase().contains(query),
          );
    }).toList();

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      children: [
        const ReceivingStage(1),
        const SizedBox(height: 12),
        Text(
          widget.warehouseName,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        TextField(
          onChanged: (value) => setState(() => _search = value),
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.search),
            hintText: strings.searchReceiving,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final (status, label) in [
              (null, strings.allOrders),
              (ReceivingOrderStatus.ready, strings.readyOrder),
              (ReceivingOrderStatus.partlyReceived, strings.partlyReceived),
            ])
              ChoiceChip(
                label: Text(label),
                selected: _filter == status,
                onSelected: (_) => setState(() => _filter = status),
              ),
          ],
        ),
        if (_refreshing) const LinearProgressIndicator(),
        if (_storageFailed || _refreshFailed)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(
              _storageFailed
                  ? strings.draftStorageError
                  : byId.isEmpty
                  ? strings.queueUnavailable
                  : strings.cachedQueue,
            ),
          ),
        if (!_refreshing && !_storageFailed && !_refreshFailed && shown.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text(
              byId.isEmpty ? strings.noOrders : strings.noMatchingOrders,
            ),
          ),
        for (final order in shown)
          Card(
            color: JahezColors.lavender,
            child: ListTile(
              selected: split && _selected?.id == order.id,
              onTap: () => _open(_data.drafts[order.id]?.order ?? order, split),
              title: Text(
                order.supplierFor(locale),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text([order.number, ?order.shippingMark].join(' · ')),
                  Text(
                    order.status == ReceivingOrderStatus.ready
                        ? strings.readyOrder
                        : strings.partlyReceived,
                  ),
                  Text(
                    '${strings.remainingCartons(order.remainingCartons)} · ${strings.expectedCartons(order.expectedCartons)}',
                  ),
                  if (_data.receipts.containsKey(order.id))
                    Text(strings.receiptWaitingForSync)
                  else if (_data.drafts.containsKey(order.id))
                    Text(strings.savedDraft),
                ],
              ),
              trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            ),
          ),
      ],
    );
  }
}
