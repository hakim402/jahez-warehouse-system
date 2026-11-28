import 'package:flutter/material.dart';

abstract final class JahezColors {
  static const deep = Color(0xff5734c9);
  static const ink = Color(0xff17132b);
  static const muted = Color(0xff625b78);
  static const lavender = Color(0xfff4f1ff);
  static const border = Color(0xffe4ddf3);
}

ThemeData workerTheme(Locale locale) {
  const scheme = ColorScheme.light(
    primary: JahezColors.deep,
    onPrimary: Colors.white,
    surface: Colors.white,
    onSurface: JahezColors.ink,
    onSurfaceVariant: JahezColors.muted,
    outline: JahezColors.muted,
    outlineVariant: JahezColors.border,
    secondaryContainer: JahezColors.lavender,
    onSecondaryContainer: JahezColors.deep,
  );
  final font = switch (locale.languageCode) {
    'ar' => 'JahezCairo',
    'zh' => null,
    _ => 'JahezRoboto',
  };
  final theme = ThemeData(
    colorScheme: scheme,
    fontFamily: font,
    scaffoldBackgroundColor: Colors.white,
    inputDecorationTheme: const InputDecorationThemeData(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(10)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(10)),
        borderSide: BorderSide(color: JahezColors.border),
      ),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: JahezColors.lavender,
      height: 66,
      indicatorColor: JahezColors.border,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: TextStyle(
          fontFamily: font,
          fontSize: 16,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(64, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        side: const BorderSide(color: JahezColors.deep),
      ),
    ),
  );
  return theme.copyWith(
    textTheme: theme.textTheme.copyWith(
      headlineMedium: theme.textTheme.headlineMedium?.copyWith(
        fontWeight: FontWeight.w700,
      ),
      titleLarge: theme.textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
      ),
      titleMedium: theme.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}
