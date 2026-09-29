import 'dart:math';

import 'package:flutter/material.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/api_client.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import 'station.dart';
import 'station_library.dart';
import 'station_results.dart';
import 'search_page.dart';

// 发现页展示搜索入口、精选、快捷探索与热门电台；完整分类筛选在搜索页完成。
class DiscoverPage extends StatefulWidget {
  const DiscoverPage({
    super.key,
    required this.api,
    required this.player,
    required this.library,
    required this.text,
  });

  final ApiClient api;
  final PlayerController player;
  final StationLibrary library;
  final AppText text;

  // 创建可在发现和搜索之间切换的页面状态。
  @override
  State<DiscoverPage> createState() => _DiscoverPageState();
}

// 精选与快捷字典只请求一次，热门电台交给共用分页视图加载。
class _DiscoverPageState extends State<DiscoverPage> {
  bool _searchOpen = false;
  int _searchCategory = 0;
  CatalogItem? _searchItem;
  late final Future<List<CatalogItem>> _tags;
  late final Future<List<CatalogItem>> _countries;
  late final Future<List<CatalogItem>> _languages;
  late final Future<StationPage> _featured;

  // 预取精选电台和探索字典，页面重建时不会重复请求。
  @override
  void initState() {
    super.initState();
    _tags = widget.api.catalog('tags', limit: 10);
    _countries = widget.api.catalog('countries', limit: 10);
    _languages = widget.api.catalog('languages', limit: 10);
    _featured = widget.api.stations(keyword: 'ambient', pageSize: 1);
  }

  // 在发现页与独立搜索页之间切换。
  void _setSearchOpen(bool value) => setState(() => _searchOpen = value);

  // 快捷探索入口带选中项进入搜索页，搜索页负责真正的 API 过滤。
  void _openSearchWithFilter(int category, CatalogItem item) {
    setState(() {
      _searchCategory = category;
      _searchItem = item;
      _searchOpen = true;
    });
  }

  // 唯一搜索入口打开支持标签、国家与语言筛选的搜索页。
  Widget _searchEntry(BuildContext context) {
    final palette = AetherPalette.of(context);
    return TextField(
      readOnly: true,
      // 普通搜索从全部分类开始，避免沿用上次快捷入口的筛选。
      onTap: () {
        _searchCategory = 0;
        _searchItem = null;
        _setSearchOpen(true);
      },
      decoration: InputDecoration(
        hintText: widget.text.get('searchStations'),
        prefixIcon: Icon(Icons.search_rounded, color: palette.muted),
        filled: true,
        fillColor: palette.surface,
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: BorderSide(color: palette.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: BorderSide(color: palette.border),
        ),
      ),
    );
  }

  // 以设计稿的极光图片展示来自 API 的真实精选电台。
  Widget _featuredCard(BuildContext context) {
    final palette = AetherPalette.of(context);
    return FutureBuilder<StationPage>(
      future: _featured,
      // 精选请求失败时不展示虚构电台，其他列表仍可正常使用。
      builder: (context, snapshot) {
        final station = snapshot.data?.list.firstOrNull;
        if (station == null) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 28),
            Row(
              children: [
                Icon(
                  Icons.auto_awesome_rounded,
                  color: palette.primary,
                  size: 17,
                ),
                const SizedBox(width: 6),
                Text(
                  widget.text.get('editorPick').toUpperCase(),
                  style: TextStyle(
                    color: palette.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: SizedBox(
                height: 210,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset('assets/images/aurora.jpg', fit: BoxFit.cover),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Color(0xD9000B1B)],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(15),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Chip(
                            visualDensity: VisualDensity.compact,
                            label: Text(widget.text.get('live')),
                            avatar: Icon(
                              Icons.circle,
                              color: palette.live,
                              size: 10,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            station.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontFamily: 'PlusJakartaSans',
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  [
                                    station.country,
                                    station.language,
                                  ].whereType<String>().join(' · '),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Color(0xFFE2E8F0),
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                              IconButton.filled(
                                tooltip: widget.text.get('listenNow'),
                                onPressed: () =>
                                    widget.player.playStation(station),
                                icon: const Icon(Icons.play_arrow_rounded),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  // 以两列卡片展示 API 返回的热门标签，点击后进入搜索页筛选。
  Widget _genreGrid(BuildContext context) {
    final palette = AetherPalette.of(context);
    return FutureBuilder<List<CatalogItem>>(
      future: _tags,
      // 分类不可用时不影响热门电台列表。
      builder: (context, snapshot) {
        final items = snapshot.data;
        if (items == null || items.isEmpty) return const SizedBox.shrink();
        return Column(
          children: [
            const SizedBox(height: 28),
            AetherSectionHeading(
              title: widget.text.get('chooseGenre'),
              subtitle: widget.text.get('genres'),
            ),
            const SizedBox(height: 12),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: min(items.length, 6),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.65,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
              ),
              // 类别名和电台数量均来自实时分类字典。
              itemBuilder: (context, index) {
                final item = items[index];
                final color = [
                  palette.violet,
                  palette.primary,
                  palette.live,
                ][index % 3];
                return Material(
                  color: palette.surface,
                  borderRadius: BorderRadius.circular(18),
                  child: InkWell(
                    onTap: () => _openSearchWithFilter(1, item),
                    borderRadius: BorderRadius.circular(18),
                    child: Container(
                      padding: const EdgeInsets.all(13),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: palette.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.music_note_rounded,
                            color: color,
                            size: 22,
                          ),
                          const Spacer(),
                          Text(
                            item.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          Text(
                            '${item.stationCount ?? 0} ${widget.text.get('stationCount')}',
                            style: TextStyle(
                              fontSize: 11,
                              color: palette.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }

  // 从国家或语言字典绘制可水平滚动的真实筛选项。
  Widget _catalogRow(
    BuildContext context,
    Future<List<CatalogItem>> future,
    String title,
    ValueChanged<CatalogItem> onSelected,
  ) {
    final palette = AetherPalette.of(context);
    return FutureBuilder<List<CatalogItem>>(
      future: future,
      // 字典加载失败时隐藏该块，不让页面其余内容报错。
      builder: (context, snapshot) {
        final items = snapshot.data;
        if (items == null || items.isEmpty) return const SizedBox.shrink();
        return Column(
          children: [
            const SizedBox(height: 28),
            AetherSectionHeading(title: title),
            const SizedBox(height: 12),
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: min(items.length, 10),
                separatorBuilder: (context, index) => const SizedBox(width: 8),
                // 点击快捷项后在搜索页应用相应的 API id。
                itemBuilder: (context, index) {
                  final item = items[index];
                  return ActionChip(
                    onPressed: () => onSelected(item),
                    backgroundColor: palette.surface,
                    side: BorderSide(color: palette.border),
                    label: Text(
                      '${item.name}  ${item.stationCount ?? 0}',
                      style: TextStyle(color: palette.text, fontSize: 11),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  // 搜索入口、精选卡片与快捷探索内容在同一列表头部滚动。
  Widget _header(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _searchEntry(context),
        _featuredCard(context),
        _genreGrid(context),
        _catalogRow(
          context,
          _countries,
          widget.text.get('countries'),
          // 国家快捷项进入搜索页并选中对应国家。
          (item) => _openSearchWithFilter(2, item),
        ),
        _catalogRow(
          context,
          _languages,
          widget.text.get('languages'),
          // 语言快捷项进入搜索页并选中对应语言。
          (item) => _openSearchWithFilter(3, item),
        ),
        const SizedBox(height: 28),
        AetherSectionHeading(
          title: widget.text.get('popularStations'),
          subtitle: widget.text.get('live'),
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  // 发现页只加载热门电台；进入搜索页后由搜索状态管理全部筛选。
  @override
  Widget build(BuildContext context) {
    if (_searchOpen) {
      return SearchPage(
        api: widget.api,
        player: widget.player,
        library: widget.library,
        text: widget.text,
        onBack: () => _setSearchOpen(false),
        initialCategory: _searchCategory,
        initialItem: _searchItem,
      );
    }
    return Column(
      children: [
        const AetherHeader(),
        Expanded(
          child: StationResults(
            api: widget.api,
            player: widget.player,
            library: widget.library,
            text: widget.text,
            header: _header(context),
          ),
        ),
      ],
    );
  }
}
