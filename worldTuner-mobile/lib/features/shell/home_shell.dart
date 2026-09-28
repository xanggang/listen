import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
import '../vip/vip_page.dart';
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
  bool _showVip = false;

  // 切换选中的主页面，不销毁其他页面的滚动或地图位置。
  void _selectPage(int index) => setState(() => _index = index);

  // 在主内容区打开权益页，保留底部播放器和原有页面状态。
  void _openVip() => setState(() => _showVip = true);

  // 返回个人中心的原有位置，不销毁其滚动或本地数据。
  void _closeVip() => setState(() => _showVip = false);

  // 地图页让地球铺满内容区，其余页面保留品牌栏和原有布局。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    final overlayStyle =
        (palette.isDark
                ? SystemUiOverlayStyle.light
                : SystemUiOverlayStyle.dark)
            .copyWith(
              statusBarColor: Colors.transparent,
              systemNavigationBarColor: palette.surface,
              systemNavigationBarIconBrightness: palette.isDark
                  ? Brightness.light
                  : Brightness.dark,
            );
    return PopScope(
      canPop: !_showVip,
      // Android 系统返回键优先关闭权益页。
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _showVip) _closeVip();
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: overlayStyle,
        child: Scaffold(
          backgroundColor: palette.canvas,
          body: SafeArea(
            top: _showVip || _index != 0,
            bottom: false,
            child: Column(
              children: [
                Expanded(
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: Visibility(
                          visible: !_showVip,
                          maintainState: true,
                          child: IndexedStack(
                            index: _index,
                            children: [
                              MapPage(
                                api: widget.api,
                                player: widget.player,
                                library: widget.library,
                                text: widget.text,
                              ),
                              Column(
                                children: [
                                  Expanded(
                                    child: DiscoverPage(
                                      api: widget.api,
                                      player: widget.player,
                                      library: widget.library,
                                      text: widget.text,
                                    ),
                                  ),
                                ],
                              ),
                              Column(
                                children: [
                                  const AetherHeader(),
                                  Expanded(
                                    child: LeaderboardPage(
                                      api: widget.api,
                                      player: widget.player,
                                      library: widget.library,
                                      text: widget.text,
                                    ),
                                  ),
                                ],
                              ),
                              Column(
                                children: [
                                  const AetherHeader(),
                                  Expanded(
                                    child: SettingsPage(
                                      settings: widget.settings,
                                      player: widget.player,
                                      library: widget.library,
                                      text: widget.text,
                                      onViewVip: _openVip,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (_showVip)
                        Positioned.fill(
                          child: VipPage(text: widget.text, onBack: _closeVip),
                        ),
                      if (_index == 0 && !_showVip) const _MapBrand(),
                    ],
                  ),
                ),
                PlayerBar(
                  player: widget.player,
                  library: widget.library,
                  text: widget.text,
                ),
                if (!_showVip)
                  _BottomNavigation(
                    index: _index,
                    text: widget.text,
                    onSelected: _selectPage,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// 地图首页使用轻量悬浮品牌标识，避免实体标题栏压缩地球。
class _MapBrand extends StatelessWidget {
  const _MapBrand();

  // 在地图左上角保留品牌识别，同时避免遮住右侧电台数量。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    final statusBarHeight = MediaQuery.paddingOf(context).top;
    return Positioned(
      top: statusBarHeight + 12,
      left: 16,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: palette.surface.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: palette.border),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.graphic_eq_rounded, color: palette.primary, size: 20),
              const SizedBox(width: 6),
              Text(
                'worldTuner',
                style: TextStyle(
                  color: palette.text,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
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
