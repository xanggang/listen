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

// 设计稿的发现页，用真实分类字典驱动流派、国家与语言浏览。
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

  // 创建保留搜索与筛选状态的发现页。
  @override
  State<DiscoverPage> createState() => _DiscoverPageState();
}

// 分类数据只请求一次，列表查询随关键词和筛选项更新。
class _DiscoverPageState extends State<DiscoverPage> {
  bool _searchOpen = false;
  int _category = 0;
  int? _tagId;
  int? _languageId;
  int? _countryId;
  late final Future<List<CatalogItem>> _genres;
  late final Future<List<CatalogItem>> _languages;
  late final Future<List<CatalogItem>> _countries;
  late final Future<StationPage> _featured;

  // 缓存分类字典与精选电台请求，避免切换筛选时重新拉取。
  @override
  void initState() {
    super.initState();
    _genres = widget.api.catalog('tags', limit: 20);
    _languages = widget.api.catalog('languages', limit: 12);
    _countries = widget.api.catalog('countries', limit: 12);
    _featured = widget.api.stations(keyword: 'ambient', pageSize: 1);
  }

  // 在发现分类和完整搜索结果之间切换，保留原有分类选择。
  void _setSearchOpen(bool value) => setState(() => _searchOpen = value);

  // 切换发现页分类，旧列表由 ValueKey 自动失效。
  void _selectCategory(int category) => setState(() => _category = category);

  // 选择流派，保留可见的类别并重新请求对应电台。
  void _selectGenre(CatalogItem item) {
    setState(() {
      _category = 1;
      _tagId = item.id;
    });
  }

  // 选择国家，交给 API 的 countriesId 过滤。
  void _selectCountry(CatalogItem item) {
    setState(() {
      _category = 2;
      _countryId = item.id;
    });
  }

  // 选择语言，交给 API 的 languagesId 过滤。
  void _selectLanguage(CatalogItem item) {
    setState(() {
      _category = 3;
      _languageId = item.id;
    });
  }

  // 绘制搜索入口与四种聚合维度切换。
  Widget _searchAndFilters(BuildContext context) {
    final palette = AetherPalette.of(context);
    final t = widget.text.get;
    final labels = [t('all'), t('genres'), t('countries'), t('languages')];
    return Column(
      children: [
        TextField(
          readOnly: true,
          onTap: () => _setSearchOpen(true),
          decoration: InputDecoration(
            hintText: t('searchStations'),
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
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: labels.length,
            separatorBuilder: (context, index) => const SizedBox(width: 8),
            // 每个类别对应一个真实的 API 筛选维度。
            itemBuilder: (context, index) => AetherFilterChip(
              label: labels[index],
              selected: _category == index,
              onTap: () => _selectCategory(index),
            ),
          ),
        ),
      ],
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

  // 以两列卡片展示 API 返回的热门流派，点击后立即筛选。
  Widget _genreGrid(BuildContext context) {
    final palette = AetherPalette.of(context);
    return FutureBuilder<List<CatalogItem>>(
      future: _genres,
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
                    onTap: () => _selectGenre(item),
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
                // 点击分类项时向列表传入相应的 API id。
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

  // 将设计稿的各模块作为电台列表头部统一滚动。
  Widget _header(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _searchAndFilters(context),
        _featuredCard(context),
        _genreGrid(context),
        _catalogRow(
          context,
          _countries,
          widget.text.get('countries'),
          _selectCountry,
        ),
        _catalogRow(
          context,
          _languages,
          widget.text.get('languages'),
          _selectLanguage,
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

  // 将当前筛选状态映射到分页 API 并渲染发现页。
  @override
  Widget build(BuildContext context) {
    if (_searchOpen) {
      return SearchPage(
        api: widget.api,
        player: widget.player,
        library: widget.library,
        text: widget.text,
        onBack: () => _setSearchOpen(false),
      );
    }
    final filter = '$_category:$_tagId:$_languageId:$_countryId';
    return Column(
      children: [
        const AetherHeader(),
        Expanded(
          child: StationResults(
            key: ValueKey(filter),
            api: widget.api,
            player: widget.player,
            library: widget.library,
            text: widget.text,
            header: _header(context),
            tagId: _category == 1 ? _tagId : null,
            countryId: _category == 2 ? _countryId : null,
            languageId: _category == 3 ? _languageId : null,
          ),
        ),
      ],
    );
  }
}
