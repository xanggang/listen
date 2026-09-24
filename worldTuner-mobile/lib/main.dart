import 'package:flutter/material.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/api_client.dart';
import 'core/app_config.dart';
import 'core/app_text.dart';
import 'features/player/player_controller.dart';
import 'features/settings/settings_controller.dart';
import 'features/shell/home_shell.dart';

// 初始化本地设置与后台媒体服务后启动应用。
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await JustAudioBackground.init(
    androidNotificationChannelId: 'app.worldtuner.mobile.channel.audio',
    androidNotificationChannelName: 'WorldTuner audio',
    androidNotificationOngoing: true,
  );
  final settings = SettingsController(SharedPreferencesAsync());
  await settings.load();
  runApp(WorldTunerApp(settings: settings));
}

// 应用根节点，集中持有服务连接和全局播放器。
class WorldTunerApp extends StatefulWidget {
  const WorldTunerApp({super.key, required this.settings});

  final SettingsController settings;

  @override
  State<WorldTunerApp> createState() => _WorldTunerAppState();
}

// 将构建环境中的 API 地址应用到唯一的客户端实例。
class _WorldTunerAppState extends State<WorldTunerApp> {
  late final Uri? _apiOrigin = AppConfig.apiOrigin;
  late final ApiClient? _api = _apiOrigin == null
      ? null
      : ApiClient(origin: _apiOrigin);
  late final PlayerController _player = PlayerController();

  // 关闭 API 连接和音频资源。
  @override
  void dispose() {
    _api?.dispose();
    _player.dispose();
    super.dispose();
  }

  // 设置 Material 主题和语言；缺少 API 地址时展示可操作的配置提示。
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.settings,
      builder: (context, child) {
        final text = AppText(widget.settings.language);
        return MaterialApp(
          title: 'WorldTuner',
          debugShowCheckedModeBanner: false,
          themeMode: widget.settings.themeMode,
          theme: ThemeData(
            colorSchemeSeed: const Color(0xFF21B073),
            useMaterial3: true,
          ),
          darkTheme: ThemeData(
            colorSchemeSeed: const Color(0xFF21B073),
            brightness: Brightness.dark,
            useMaterial3: true,
          ),
          home: _api == null
              ? Scaffold(
                  body: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.settings_ethernet, size: 48),
                          const SizedBox(height: 16),
                          Text(text.get('apiMissing')),
                          const SizedBox(height: 8),
                          Text(
                            text.get('apiMissingHelp'),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              : HomeShell(
                  api: _api,
                  player: _player,
                  settings: widget.settings,
                  text: text,
                ),
        );
      },
    );
  }
}
