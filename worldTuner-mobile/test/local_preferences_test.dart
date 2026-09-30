import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:worldtuner_mobile/features/settings/settings_controller.dart';
import 'package:worldtuner_mobile/features/stations/station.dart';
import 'package:worldtuner_mobile/features/stations/station_library.dart';

// 验证用户最常使用的语言、外观和收藏在应用重新创建后仍可恢复。
void main() {
  // 每个用例使用独立的平台偏好，避免读到上一用例的值。
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('language and dark mode persist across controllers', () async {
    final settings = SettingsController(SharedPreferencesAsync());
    await settings.load();
    expect(settings.language, 'zh');
    expect(settings.themeMode, ThemeMode.system);

    await settings.setLanguage('en');
    await settings.setThemeMode(ThemeMode.dark);

    final restored = SettingsController(SharedPreferencesAsync());
    await restored.load();
    expect(restored.language, 'en');
    expect(restored.themeMode, ThemeMode.dark);

    await restored.setLanguage('invalid');
    expect(restored.language, 'en');
  });

  test('favorites and listening history survive reload', () async {
    final library = StationLibrary(SharedPreferencesAsync());
    await library.load();
    const station = Station(
      id: '42',
      name: 'Example Radio',
      url: 'https://example.com/stream',
    );
    await library.toggleFavorite(station);
    await library.recordPlayed(station);

    final restored = StationLibrary(SharedPreferencesAsync());
    await restored.load();
    expect(restored.isFavorite('42'), isTrue);
    expect(restored.recent.single.name, 'Example Radio');

    await restored.toggleFavorite(station);
    expect(restored.isFavorite('42'), isFalse);
  });

  test('one broken saved station does not hide valid favorites', () async {
    final prefs = SharedPreferencesAsync();
    await prefs.setString(
      'favorite_stations',
      '[{"id":"broken","name":"Bad"},'
          '{"id":42,"name":"Valid","url":"https://example.com"}]',
    );

    final library = StationLibrary(prefs);
    await library.load();
    expect(library.favorites.map((station) => station.id), ['42']);
  });
}
