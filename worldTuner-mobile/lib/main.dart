import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/api_client.dart';
import 'core/app_config.dart';
import 'core/app_text.dart';
import 'core/aether_theme.dart';
import 'core/metrics_reporter.dart';
import 'features/onboarding/entry_store.dart';
import 'features/onboarding/register_page.dart';
import 'features/player/player_controller.dart';
import 'features/settings/settings_controller.dart';
import 'features/shell/home_shell.dart';
import 'features/stations/station_library.dart';

// 初始化本地设置与后台媒体服务后启动应用。
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await JustAudioBackground.init(
    androidNotificationChannelId: 'app.worldtuner.mobile.channel.audio',
    androidNotificationChannelName: 'worldTuner audio',
    androidNotificationOngoing: true,
  );
  final preferences = SharedPreferencesAsync();
  final settings = SettingsController(preferences);
  await settings.load();
  final library = StationLibrary(preferences);
  await library.load();
  final entry = EntryStore(preferences);
  await entry.load();
  final origin = AppConfig.apiOrigin;
  final metrics = origin == null
      ? null
      : MetricsReporter(origin: origin, preferences: preferences);
  runApp(
    WorldTunerApp(
      settings: settings,
      library: library,
      entry: entry,
      metrics: metrics,
    ),
  );
}

// 应用根节点，集中持有服务连接和全局播放器。
class WorldTunerApp extends StatefulWidget {
  // 注入已加载的本地状态，在首次打开时展示欢迎入口。
  const WorldTunerApp({
    super.key,
    required this.settings,
    required this.library,
    required this.entry,
    required this.metrics,
  });

  final SettingsController settings;
  final StationLibrary library;
  final EntryStore entry;
  final MetricsReporter? metrics;

  // 创建持有 API 与全局播放器的根状态。
  @override
  State<WorldTunerApp> createState() => _WorldTunerAppState();
}

// 将构建环境中的 API 地址应用到唯一的客户端实例。
class _WorldTunerAppState extends State<WorldTunerApp>
    with WidgetsBindingObserver {
  late final Uri? _apiOrigin = AppConfig.apiOrigin;
  late final ApiClient? _api = _apiOrigin == null
      ? null
      : ApiClient(origin: _apiOrigin);
  late final PlayerController _player = PlayerController(widget.library);
  late bool _entered = widget.entry.entered;
  bool _entering = false;

  // 首次显示的欢迎页或地图只记录一次访问，并监听后台恢复。
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final metrics = widget.metrics;
    if (metrics != null) {
      unawaited(metrics.trackPage(_entered ? 'map' : 'welcome'));
    }
  }

  // Android 从后台回到前台时按时间间隔补记页面访问。
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && widget.metrics != null) {
      unawaited(widget.metrics!.trackResume());
    }
  }

  // 首版直接进入应用，并将欢迎页完成状态保存在设备本地。
  Future<void> _enterApp() async {
    if (_entering || _entered) return;
    _entering = true;
    try {
      await widget.entry.markEntered();
    } catch (_) {
      // 本地写入失败时仍允许访问无账户功能，下次启动会再次展示欢迎页。
    } finally {
      if (mounted) {
        setState(() {
          _entered = true;
          _entering = false;
        });
        if (widget.metrics != null) unawaited(widget.metrics!.trackPage('map'));
      }
    }
  }

  // 关闭 API 连接和音频资源。
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _api?.dispose();
    widget.metrics?.dispose();
    _player.dispose();
    super.dispose();
  }

  // 设置 Material 主题和语言；缺少 API 地址时展示可操作的配置提示。
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.settings,
      // 设置变化时重新生成当前语言的文案与应用主题。
      builder: (context, child) {
        final text = AppText(widget.settings.language);
        return MaterialApp(
          title: 'worldTuner',
          debugShowCheckedModeBanner: false,
          themeMode: widget.settings.themeMode,
          theme: buildAetherTheme(Brightness.light),
          darkTheme: buildAetherTheme(Brightness.dark),
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
              : !_entered
              ? RegisterPage(
                  text: text,
                  // 欢迎页不执行鉴权，入口统一使用本地完成状态。
                  onEnter: () => unawaited(_enterApp()),
                )
              : HomeShell(
                  api: _api,
                  player: _player,
                  library: widget.library,
                  settings: widget.settings,
                  text: text,
                  metrics: widget.metrics,
                ),
        );
      },
    );
  }
}
