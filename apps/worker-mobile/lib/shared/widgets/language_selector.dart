import 'package:flutter/material.dart';

class LanguageSelector extends StatelessWidget {
  const LanguageSelector({
    super.key,
    required this.locale,
    required this.onChanged,
  });

  final Locale locale;
  final ValueChanged<Locale> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<String>(
      showSelectedIcon: false,
      expandedInsets: EdgeInsets.zero,
      style: SegmentedButton.styleFrom(
        selectedBackgroundColor: Colors.white,
        backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
        selectedForegroundColor: Theme.of(context).colorScheme.primary,
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 10),
        minimumSize: const Size(0, 48),
      ),
      segments: const [
        ButtonSegment(
          value: 'en',
          label: Text('English', style: TextStyle(fontFamily: 'JahezRoboto')),
        ),
        ButtonSegment(
          value: 'ar',
          label: Text('العربية', style: TextStyle(fontFamily: 'JahezCairo')),
        ),
        ButtonSegment(value: 'zh', label: Text('简体中文')),
      ],
      selected: {locale.languageCode},
      onSelectionChanged: (value) => onChanged(Locale(value.single)),
    );
  }
}
