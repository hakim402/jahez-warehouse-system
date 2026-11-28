import 'package:flutter/material.dart';

import '../../app/worker_theme.dart';
import '../../l10n/generated/worker_strings.dart';
import '../../shared/widgets/language_selector.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({
    super.key,
    required this.warehouseName,
    required this.locale,
    required this.onLocaleChanged,
    required this.onSignOut,
    required this.countDrafts,
  });

  final String warehouseName;
  final Locale locale;
  final ValueChanged<Locale> onLocaleChanged;
  final VoidCallback onSignOut;
  final Future<int> Function() countDrafts;

  Future<void> _confirmSignOut(BuildContext context) async {
    int? drafts;
    try {
      drafts = await countDrafts().timeout(const Duration(seconds: 3));
    } catch (_) {
      // Sign-out still runs the purge if the count cannot be read.
    }
    if (!context.mounted) return;
    final strings = WorkerStrings.of(context);
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      constraints: const BoxConstraints(maxWidth: 560),
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                strings.signOutTitle,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(switch (drafts) {
                null => strings.discardDraftsUnknown,
                0 => strings.signOutMessage,
                final count => strings.discardDrafts(count),
              }),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(strings.signOut),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(strings.cancel),
              ),
            ],
          ),
        ),
      ),
    );
    if (context.mounted && confirmed == true) onSignOut();
  }

  @override
  Widget build(BuildContext context) {
    final strings = WorkerStrings.of(context);
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(strings.settings, style: textTheme.headlineMedium),
        const SizedBox(height: 16),
        Text(strings.language, style: textTheme.titleMedium),
        const SizedBox(height: 8),
        LanguageSelector(locale: locale, onChanged: onLocaleChanged),
        const SizedBox(height: 16),
        DecoratedBox(
          decoration: BoxDecoration(
            color: JahezColors.lavender,
            borderRadius: BorderRadius.circular(16),
          ),
          child: ListTile(
            leading: const Icon(
              Icons.warehouse_outlined,
              color: JahezColors.deep,
            ),
            title: Text(warehouseName),
            subtitle: Text(strings.sharedDevice),
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: () => _confirmSignOut(context),
          child: Text(strings.signOut),
        ),
      ],
    );
  }
}
