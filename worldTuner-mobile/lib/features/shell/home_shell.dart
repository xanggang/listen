import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_text.dart';
import '../map/map_page.dart';
import '../player/player_bar.dart';
import '../player/player_controller.dart';
import '../settings/settings_controller.dart';
import '../settings/settings_page.dart';
import '../stations/discover_page.dart';
import '../stations/leaderboard_page.dart';

// 四个 Web 同款入口组成移动端主导航，全局播放器置于导航之上。
class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.api,
    required this.player,
    required this.settings,
    required this.text,
  });

  final ApiClient api;
  final PlayerController player;
  final SettingsController settings;
  final AppText text;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

// 保持页面状态，以便切换入口后保留地图位置和列表滚动位置。
class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  // 绘制常驻页面、迷你播放器和底部导航。
  @override
  Widget build(BuildContext context) {
    final t = widget.text.get;
    return Scaffold(
      body: Column(
        children: [
          Expanded(
            child: IndexedStack(
              index: _index,
              children: [
                MapPage(
                  api: widget.api,
                  player: widget.player,
                  text: widget.text,
                ),
                DiscoverPage(
                  api: widget.api,
                  player: widget.player,
                  text: widget.text,
                ),
                LeaderboardPage(
                  api: widget.api,
                  player: widget.player,
                  text: widget.text,
                ),
                SettingsPage(settings: widget.settings, text: widget.text),
              ],
            ),
          ),
          PlayerBar(player: widget.player, text: widget.text),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.public),
            label: t('map'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.search),
            label: t('discover'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.leaderboard_outlined),
            label: t('charts'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.settings_outlined),
            label: t('settings'),
          ),
        ],
      ),
    );
  }
}
