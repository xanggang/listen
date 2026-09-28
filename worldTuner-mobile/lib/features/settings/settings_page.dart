import 'package:flutter/material.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import '../stations/station_library.dart';
import '../stations/station_results.dart';
import 'settings_controller.dart';

// 个人中心承载本地收藏、收听历史以及全局主题和语言设置。
class SettingsPage extends StatelessWidget {
  const SettingsPage({
    super.key,
    required this.settings,
    required this.player,
    required this.library,
    required this.text,
  });

  final SettingsController settings;
  final PlayerController player;
  final StationLibrary library;
  final AppText text;

  // 统一绘制带边框的设置分组。
  Widget _section(BuildContext context, List<Widget> children) {
    final palette = AetherPalette.of(context);
    return Container(
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: palette.border),
      ),
      child: Column(children: children),
    );
  }

  // 展示由当前设备真实收藏与历史计算的个人概览。
  Widget _overview(BuildContext context) {
    final palette = AetherPalette.of(context);
    return _section(context, [
      Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: palette.primarySoft,
              child: Icon(
                Icons.person_rounded,
                color: palette.primary,
                size: 30,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    text.get('profile'),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    text.get('localOnly'),
                    style: TextStyle(color: palette.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      Divider(height: 1, color: palette.border),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(
          children: [
            _stat(context, library.favorites.length, text.get('favorites')),
            _stat(context, library.recent.length, text.get('history')),
          ],
        ),
      ),
    ]);
  }

  // 个人概览数字只读取本机保存的数据。
  Widget _stat(BuildContext context, int value, String label) {
    final palette = AetherPalette.of(context);
    return Expanded(
      child: Column(
        children: [
          Text(
            '$value',
            style: TextStyle(
              color: palette.primary,
              fontSize: 24,
              fontFamily: 'PlusJakartaSans',
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(label, style: TextStyle(color: palette.muted, fontSize: 12)),
        ],
      ),
    );
  }

  // 收藏和最近播放使用真实本地列表，点击行可直接播放。
  Widget _librarySection(BuildContext context, bool favorites) {
    final palette = AetherPalette.of(context);
    final stations = favorites ? library.favorites : library.recent;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AetherSectionHeading(
          title: text.get(favorites ? 'favorites' : 'history'),
        ),
        const SizedBox(height: 10),
        if (stations.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: palette.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: palette.border),
            ),
            child: Text(
              text.get(favorites ? 'noFavorites' : 'noHistory'),
              style: TextStyle(color: palette.muted),
            ),
          )
        else
          ...stations
              .take(4)
              .map(
                // 每条历史记录复用可播放和可收藏的电台行。
                (station) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: StationTile(
                    station: station,
                    library: library,
                    text: text,
                    onPlay: () => player.playStation(station),
                  ),
                ),
              ),
      ],
    );
  }

  // 深色、浅色和跟随系统均直接修改持久化设置。
  Widget _themeSection(BuildContext context) {
    final palette = AetherPalette.of(context);
    final modes = <(ThemeMode, IconData, String)>[
      (
        ThemeMode.system,
        Icons.brightness_auto_outlined,
        text.get('followSystem'),
      ),
      (ThemeMode.light, Icons.wb_sunny_outlined, text.get('lightMode')),
      (ThemeMode.dark, Icons.dark_mode_outlined, text.get('darkMode')),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AetherSectionHeading(title: text.get('appearance')),
        const SizedBox(height: 10),
        _section(context, [
          for (var index = 0; index < modes.length; index++) ...[
            if (index > 0) Divider(height: 1, color: palette.border),
            ListTile(
              onTap: () => settings.setThemeMode(modes[index].$1),
              title: Text(modes[index].$3),
              leading: Icon(modes[index].$2, color: palette.primary),
              trailing: settings.themeMode == modes[index].$1
                  ? Icon(Icons.check_circle_rounded, color: palette.primary)
                  : Icon(Icons.circle_outlined, color: palette.muted),
              dense: true,
            ),
          ],
        ]),
      ],
    );
  }

  // 中英文切换写入本地偏好，应用根节点会立即重建全部页面文案。
  Widget _languageSection(BuildContext context) {
    final palette = AetherPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AetherSectionHeading(title: text.get('localization')),
        const SizedBox(height: 10),
        _section(context, [
          ListTile(
            leading: Icon(Icons.language_rounded, color: palette.primary),
            title: Text(text.get('language')),
            subtitle: Text(
              text.get('localOnly'),
              style: TextStyle(color: palette.muted),
            ),
            trailing: DropdownButton<String>(
              value: settings.language,
              underline: const SizedBox.shrink(),
              items: const [
                DropdownMenuItem(value: 'zh', child: Text('简体中文')),
                DropdownMenuItem(value: 'en', child: Text('English')),
              ],
              // 输入限制为当前已实现的中英文两种语言。
              onChanged: (value) {
                if (value != null) settings.setLanguage(value);
              },
            ),
          ),
        ]),
      ],
    );
  }

  // 按设计稿顺序展示个人概览、收藏、主题、语言和应用信息。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return ListenableBuilder(
      listenable: library,
      // 收藏和历史变化时同步刷新统计与预览行。
      builder: (context, child) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
        children: [
          _overview(context),
          const SizedBox(height: 25),
          _librarySection(context, true),
          const SizedBox(height: 22),
          _librarySection(context, false),
          const SizedBox(height: 22),
          _themeSection(context),
          const SizedBox(height: 22),
          _languageSection(context),
          const SizedBox(height: 22),
          _section(context, [
            ListTile(
              leading: Icon(Icons.info_outline_rounded, color: palette.muted),
              title: Text(text.get('aboutApp')),
              subtitle: const Text('worldTuner · 1.0.0'),
            ),
          ]),
        ],
      ),
    );
  }
}
