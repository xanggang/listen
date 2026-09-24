import 'package:flutter/material.dart';

import '../../core/app_text.dart';
import 'settings_controller.dart';

// 对应 Web 设置页，提供语言、外观和版本信息。
class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key, required this.settings, required this.text});

  final SettingsController settings;
  final AppText text;

  // 构建本地偏好设置选项，修改后立即刷新应用主题和文案。
  @override
  Widget build(BuildContext context) {
    final t = text.get;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            t('settings'),
            style: Theme.of(
              context,
            ).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 28),
          Text(t('preferences'), style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 10),
          Card(
            child: Column(
              children: [
                ListTile(
                  title: Text(t('language')),
                  leading: const Icon(Icons.language),
                  trailing: DropdownButton<String>(
                    value: settings.language,
                    underline: const SizedBox.shrink(),
                    items: [
                      DropdownMenuItem(value: 'en', child: Text(t('english'))),
                      DropdownMenuItem(value: 'zh', child: Text(t('chinese'))),
                    ],
                    onChanged: (value) {
                      if (value != null) settings.setLanguage(value);
                    },
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  title: Text(t('theme')),
                  leading: const Icon(Icons.dark_mode_outlined),
                  trailing: DropdownButton<ThemeMode>(
                    value: settings.themeMode,
                    underline: const SizedBox.shrink(),
                    items: [
                      DropdownMenuItem(
                        value: ThemeMode.system,
                        child: Text(t('system')),
                      ),
                      DropdownMenuItem(
                        value: ThemeMode.light,
                        child: Text(t('light')),
                      ),
                      DropdownMenuItem(
                        value: ThemeMode.dark,
                        child: Text(t('dark')),
                      ),
                    ],
                    onChanged: (value) {
                      if (value != null) settings.setThemeMode(value);
                    },
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Card(
            child: ListTile(
              leading: const Icon(Icons.info_outline),
              title: Text(t('about')),
              subtitle: Text('WorldTuner 1.0 · ${t('online')}'),
            ),
          ),
        ],
      ),
    );
  }
}
