import 'package:flutter/material.dart';

// 根据当前亮度提供设计稿中的语义颜色，避免页面散落硬编码色值。
class AetherPalette {
  const AetherPalette(this.isDark);

  final bool isDark;

  Color get canvas =>
      isDark ? const Color(0xFF0E1321) : const Color(0xFFF8FAFC);
  Color get surface => isDark ? const Color(0xFF161B2A) : Colors.white;
  Color get surfaceRaised =>
      isDark ? const Color(0xFF252A39) : const Color(0xFFF1F5F9);
  Color get surfaceDeep =>
      isDark ? const Color(0xFF090E1C) : const Color(0xFFEFF6FB);
  Color get primary =>
      isDark ? const Color(0xFF00F2FE) : const Color(0xFF0284C7);
  Color get primarySoft =>
      isDark ? const Color(0xFF123844) : const Color(0xFFEAF7FE);
  Color get onPrimary => isDark ? const Color(0xFF00373A) : Colors.white;
  Color get text => isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A);
  Color get muted => isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
  Color get border =>
      isDark ? const Color(0xFF283247) : const Color(0xFFE2E8F0);
  Color get live => isDark ? const Color(0xFF67F4B7) : const Color(0xFF059669);
  Color get gold => isDark ? const Color(0xFFFCD34D) : const Color(0xFFD97706);
  Color get violet =>
      isDark ? const Color(0xFFC4ABFF) : const Color(0xFF7C3AED);

  // 从 Material 主题亮度恢复当前设计色板。
  static AetherPalette of(BuildContext context) =>
      AetherPalette(Theme.of(context).brightness == Brightness.dark);
}

// 统一构造深浅主题，页面组件只消费语义色和两套字体。
ThemeData buildAetherTheme(Brightness brightness) {
  final palette = AetherPalette(brightness == Brightness.dark);
  final base = ThemeData(brightness: brightness, useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: palette.canvas,
    colorScheme: ColorScheme.fromSeed(
      seedColor: palette.primary,
      brightness: brightness,
      primary: palette.primary,
      onPrimary: palette.onPrimary,
      surface: palette.surface,
      onSurface: palette.text,
    ),
    textTheme: base.textTheme
        .apply(
          fontFamily: 'Inter',
          bodyColor: palette.text,
          displayColor: palette.text,
        )
        .copyWith(
          headlineLarge: TextStyle(
            fontFamily: 'PlusJakartaSans',
            fontSize: 28,
            fontWeight: FontWeight.w700,
            color: palette.text,
          ),
          headlineMedium: TextStyle(
            fontFamily: 'PlusJakartaSans',
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: palette.text,
          ),
          titleLarge: TextStyle(
            fontFamily: 'PlusJakartaSans',
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: palette.text,
          ),
        ),
    cardColor: palette.surface,
    dividerColor: palette.border,
    appBarTheme: AppBarTheme(
      backgroundColor: palette.canvas,
      foregroundColor: palette.text,
      elevation: 0,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: palette.primary),
  );
}
