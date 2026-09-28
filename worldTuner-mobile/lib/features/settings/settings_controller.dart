import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

// 本地保存语言和主题，无需首版用户体系。
class SettingsController extends ChangeNotifier {
  // 注入平台偏好以加载并保存本机语言和外观选择。
  SettingsController(this._prefs);

  final SharedPreferencesAsync _prefs;
  String language = 'zh';
  ThemeMode themeMode = ThemeMode.system;

  // 从平台偏好设置恢复语言与主题。
  Future<void> load() async {
    final savedLanguage = await _prefs.getString('language');
    final savedTheme = await _prefs.getString('theme');
    language = savedLanguage == 'en' ? 'en' : 'zh';
    themeMode = switch (savedTheme) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    notifyListeners();
  }

  // 切换界面语言并写入本地偏好。
  Future<void> setLanguage(String value) async {
    if (value != 'en' && value != 'zh') return;
    language = value;
    notifyListeners();
    await _prefs.setString('language', value);
  }

  // 切换外观模式并写入本地偏好。
  Future<void> setThemeMode(ThemeMode value) async {
    themeMode = value;
    notifyListeners();
    await _prefs.setString('theme', value.name);
  }
}
