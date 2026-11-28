import 'package:flutter/material.dart';

import '../../app/worker_theme.dart';
import '../../l10n/generated/worker_strings.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.warehouseName});

  final String warehouseName;

  @override
  Widget build(BuildContext context) {
    final strings = WorkerStrings.of(context);
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(warehouseName, style: textTheme.headlineMedium),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, box) {
            final sideBySide =
                box.maxWidth >= 330 &&
                MediaQuery.textScalerOf(context).scale(16) <= 22;
            final width = sideBySide ? (box.maxWidth - 12) / 2 : box.maxWidth;
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                SizedBox(
                  width: width,
                  child: _WorkflowCard(
                    icon: Icons.move_to_inbox_outlined,
                    title: strings.receiving,
                    subtitle: strings.comingSoon,
                    primary: true,
                  ),
                ),
                SizedBox(
                  width: width,
                  child: _WorkflowCard(
                    icon: Icons.local_shipping_outlined,
                    title: strings.dispatch,
                    subtitle: strings.comingSoon,
                  ),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 24),
        Text(strings.syncAndUploads, style: textTheme.titleLarge),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: JahezColors.lavender,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            strings.comingSoon,
            style: textTheme.bodyMedium?.copyWith(color: JahezColors.muted),
          ),
        ),
      ],
    );
  }
}

class _WorkflowCard extends StatelessWidget {
  const _WorkflowCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.primary = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final titleColor = primary ? Colors.white : JahezColors.ink;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: primary ? JahezColors.deep : JahezColors.lavender,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: primary ? JahezColors.deep : JahezColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            color: primary ? Colors.white : JahezColors.deep,
            size: 28,
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(color: titleColor),
          ),
          Text(
            subtitle,
            style: theme.textTheme.bodySmall?.copyWith(
              color: primary ? Colors.white : JahezColors.muted,
            ),
          ),
        ],
      ),
    );
  }
}
