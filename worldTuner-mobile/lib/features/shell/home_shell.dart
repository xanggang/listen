import 'package:flutter/material.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_icons.dart';
import '../../core/aether_widgets.dart';
import '../../core/api_client.dart';
import '../../core/app_text.dart';
import '../map/map_page.dart';
import '../player/player_bar.dart';
import '../player/player_controller.dart';
import '../settings/settings_controller.dart';
import '../settings/settings_page.dart';
import '../stations/discover_page.dart';
import '../stations/leaderboard_page.dart';
import '../stations/station_library.dart';

// 设计稿的四栏导航与常驻播放器，页面切换时保持地图和列表状态。
class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.api,
    required this.player,
    required this.library,
    required this.settings,
    required this.text,
  });

  final ApiClient api;
  final PlayerController player;
  final StationLibrary library;
  final SettingsController settings;
  final AppText text;

  // 创建保持导航状态的主容器。
  @override
  State<HomeShell> createState() => _HomeShellState();
}

// 主容器只维护当前页面索引；数据状态由对应模块持有。
class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  // 切换选中的主页面，不销毁其他页面的滚动或地图位置。
  void _selectPage(int index) => setState(() => _index = index);

  // 绘制品牌栏、页面、迷你播放器和底部导航。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return Scaffold(
      backgroundColor: palette.canvas,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const AetherHeader(),
            Expanded(
              child: IndexedStack(
                index: _index,
                children: [
                  MapPage(
                    api: widget.api,
                    player: widget.player,
                    library: widget.library,
                    text: widget.text,
                  ),
                  DiscoverPage(
                    api: widget.api,
                    player: widget.player,
                    library: widget.library,
                    text: widget.text,
                  ),
                  LeaderboardPage(
                    api: widget.api,
                    player: widget.player,
                    library: widget.library,
                    text: widget.text,
                  ),
                  SettingsPage(
                    settings: widget.settings,
                    player: widget.player,
                    library: widget.library,
                    text: widget.text,
                  ),
                ],
              ),
            ),
            PlayerBar(
              player: widget.player,
              library: widget.library,
              text: widget.text,
            ),
            _BottomNavigation(
              index: _index,
              text: widget.text,
              onSelected: _selectPage,
            ),
          ],
        ),
      ),
    );
  }
}

// 四栏图标与底色按照深浅主题同步切换。
class _BottomNavigation extends StatelessWidget {
  const _BottomNavigation({
    required this.index,
    required this.text,
    required this.onSelected,
  });

  final int index;
  final AppText text;
  final ValueChanged<int> onSelected;

  // 单个导航项使用固定触摸高度，避免系统字体缩放影响点击区域。
  Widget _item(
    BuildContext context,
    int itemIndex,
    AetherNavSymbol icon,
    String label,
  ) {
    final palette = AetherPalette.of(context);
    final selected = index == itemIndex;
    return Expanded(
      child: InkWell(
        onTap: () => onSelected(itemIndex),
        borderRadius: BorderRadius.circular(28),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 58,
                height: 32,
                decoration: BoxDecoration(
                  color: selected ? palette.primarySoft : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                  border: selected
                      ? Border.all(
                          color: palette.primary.withValues(alpha: 0.2),
                        )
                      : null,
                ),
                child: Center(
                  child: AetherNavIcon(
                    symbol: icon,
                    color: selected ? palette.primary : palette.muted,
                  ),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  color: selected ? palette.primary : palette.muted,
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // 绘制系统安全区内的浮动式底部导航。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return Container(
      decoration: BoxDecoration(
        color: palette.surface,
        border: Border(top: BorderSide(color: palette.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            _item(context, 0, AetherNavSymbol.globe, text.get('globe')),
            _item(context, 1, AetherNavSymbol.discover, text.get('discover')),
            _item(context, 2, AetherNavSymbol.charts, text.get('charts')),
            _item(context, 3, AetherNavSymbol.profile, text.get('profile')),
          ],
        ),
      ),
    );
  }
}
