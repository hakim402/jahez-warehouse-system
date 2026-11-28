import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_mobile/features/receiving/screens/receipt/receipt_draft_screen.dart';
import 'package:worker_mobile/l10n/generated/worker_strings.dart';
import 'package:worker_mobile/offline/receiving_receipt.dart';

import 'fixtures/receiving_order.dart';

void main() {
  testWidgets('corrects a partial receipt and saves its measured summary', (
    tester,
  ) async {
    final order = fixtureOrder();
    var draft = ReceiptDraft('fixed-reference', order, {});
    LocalReceipt? receipt;
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: WorkerStrings.localizationsDelegates,
        supportedLocales: WorkerStrings.supportedLocales,
        home: Scaffold(
          body: ReceiptDraftScreen(
            order: order,
            draft: null,
            confirmed: null,
            onSave: (line, cartons) async => draft = ReceiptDraft(
              draft.id,
              order,
              {line.id: cartons},
              details: draft.details,
            ),
            onSaveDetails: (line, details) async => draft = ReceiptDraft(
              draft.id,
              order,
              draft.cartons,
              details: {line.id: details},
            ),
            onConfirm: () async => receipt = LocalReceipt(order, {
              'clientOperationId': draft.id,
              'lines': draft.delivery.map((line) => line.toJson()).toList(),
            }),
            onDone: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    Future<void> tapVisible(Finder finder) async {
      await tester.ensureVisible(finder);
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    await tapVisible(find.widgetWithText(FilledButton, 'Review and confirm'));
    await tapVisible(find.widgetWithText(OutlinedButton, 'Edit items'));
    await tapVisible(find.byTooltip('Remove one carton'));
    await tapVisible(find.text('Size and weight'));
    for (final (index, value) in ['60', '45', '9', '12,5'].indexed) {
      await tester.enterText(find.byType(TextFormField).at(index), value);
    }
    await tester.pumpAndSettle();
    expect(find.text('0.0729 CBM'), findsOneWidget);
    await tapVisible(find.widgetWithText(FilledButton, 'Save measurements'));
    await tapVisible(find.text('Report a problem'));
    await tapVisible(find.text('Damaged goods'));
    await tapVisible(find.widgetWithText(FilledButton, 'Save problem'));
    await tapVisible(find.widgetWithText(FilledButton, 'Review and confirm'));
    expect(find.text('Still missing'), findsNWidgets(2));
    expect(find.text('12.5 kg'), findsOneWidget);
    await tapVisible(find.widgetWithText(FilledButton, 'Confirm receipt'));
    expect(find.text('Receipt saved on device'), findsOneWidget);
    expect(receipt?.delivery.single.cartons, 3);
    expect(receipt?.delivery.single.details.damaged, isTrue);
    expect(receipt?.delivery.single.details.measurements.cbm(3), 0.0729);
    expect(tester.takeException(), isNull);
  });
}
