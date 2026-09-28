import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/api_client.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import 'station.dart';
import 'station_library.dart';

// 独立搜索视图沿用全局播放器和导航，只展示 Worker 返回的电台资料。
class SearchPage extends StatefulWidget {
  const SearchPage({
    super.key,
    required this.api,
    required this.player,
    required this.library,
    required this.text,
    required this.onBack,
  });

  final ApiClient api;
  final PlayerController player;
  final StationLibrary library;
  final AppText text;
  final VoidCallback onBack;

  // 创建搜索视图状态，管理防抖、筛选和分页。
  @override
  State<SearchPage> createState() => _SearchPageState();
}

// 每次修改查询都会让旧请求失效，避免慢请求覆盖新搜索结果。
class _SearchPageState extends State<SearchPage> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  final List<Station> _stations = [];
  Timer? _debounce;
  late final Future<List<CatalogItem>> _genres;
  late final Future<List<CatalogItem>> _languages;
  late final Future<List<CatalogItem>> _countries;
  String _keyword = '';
  int? _tagId;
  int? _languageId;
  int? _countryId;
  int? _nextPage = 1;
  int _generation = 0;
  bool _loading = false;
  bool _failed = false;

  // 首次进入展示 API 热门电台，并预取筛选字典。
  @override
  void initState() {
    super.initState();
    _genres = _loadCatalog('tags');
    _languages = _loadCatalog('languages');
    _countries = _loadCatalog('countries');
    _scroll.addListener(_onScroll);
    unawaited(_load());
  }

  // 筛选字典失败时返回空列表，避免未打开筛选面板时产生未处理错误。
  Future<List<CatalogItem>> _loadCatalog(String kind) async {
    try {
      return await widget.api.catalog(kind, limit: 20);
    } catch (_) {
      return [];
    }
  }

  // 滚动接近末尾时按 Worker 的 nextPage 继续加载。
  void _onScroll() {
    if (_scroll.hasClients && _scroll.position.extentAfter < 320) {
      unawaited(_load());
    }
  }

  // 输入停止后提交关键词，减少每个按键都触发的 API 请求。
  void _onQueryChanged(String value) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (mounted) _applyQuery(value);
    });
  }

  // 应用关键词并回到第一页；同一关键词不重复查询。
  void _applyQuery(String value) {
    final keyword = value.trim();
    if (keyword == _keyword) return;
    _keyword = keyword;
    unawaited(_load(reset: true));
  }

  // 清空输入和筛选前先取消待提交的旧关键词。
  void _clearQuery() {
    _debounce?.cancel();
    _input.clear();
    _applyQuery('');
    setState(() {});
  }

  // 读取当前页；重置时使进行中的旧请求无法写回页面。
  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _generation++;
      _nextPage = 1;
      _stations.clear();
      if (_scroll.hasClients) _scroll.jumpTo(0);
    }
    if (_loading && !reset) return;
    final page = _nextPage;
    if (page == null) return;
    final generation = _generation;
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final result = await widget.api.stations(
        page: page,
        keyword: _keyword,
        tagId: _tagId,
        languageId: _languageId,
        countryId: _countryId,
      );
      if (!mounted || generation != _generation) return;
      setState(() {
        final seen = _stations.map((station) => station.id).toSet();
        _stations.addAll(result.list.where((station) => seen.add(station.id)));
        _nextPage = result.nextPage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  // 选择一个筛选项并关闭面板，选中项再次点击则取消筛选。
  void _selectFilter(String kind, int id) {
    setState(() {
      switch (kind) {
        case 'tags':
          _tagId = _tagId == id ? null : id;
        case 'languages':
          _languageId = _languageId == id ? null : id;
        case 'countries':
          _countryId = _countryId == id ? null : id;
      }
    });
    Navigator.of(context).pop();
    unawaited(_load(reset: true));
  }

  // 打开真实分类字典组成的筛选面板，不使用设计稿中的静态假数据。
  void _openFilters() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      // 各字典加载互不依赖，单组失败时不影响其他筛选。
      builder: (context) => FractionallySizedBox(
        heightFactor: 0.78,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            child: ListView(
              children: [
                Text(
                  widget.text.get('filterOptions'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                _filterGroup(
                  'tags',
                  widget.text.get('genres'),
                  _genres,
                  _tagId,
                ),
                _filterGroup(
                  'languages',
                  widget.text.get('languages'),
                  _languages,
                  _languageId,
                ),
                _filterGroup(
                  'countries',
                  widget.text.get('countries'),
                  _countries,
                  _countryId,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // 构造一组可滚动的真实分类筛选标签。
  Widget _filterGroup(
    String kind,
    String title,
    Future<List<CatalogItem>> future,
    int? selectedId,
  ) {
    return FutureBuilder<List<CatalogItem>>(
      future: future,
      // 失败的字典仅隐藏本组，已有搜索仍然可用。
      builder: (context, snapshot) {
        final items = snapshot.data;
        if (items == null || items.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  for (final item in items)
                    FilterChip(
                      label: Text(item.name),
                      selected: selectedId == item.id,
                      onSelected: (_) => _selectFilter(kind, item.id),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // 释放输入、滚动和防抖资源，并使未完成的请求失效。
  @override
  void dispose() {
    _generation++;
    _debounce?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // 顶部搜索框复刻设计稿的返回、清空和筛选入口。
  Widget _searchHeader(BuildContext context) {
    final palette = AetherPalette.of(context);
    final hasFilters =
        _tagId != null || _languageId != null || _countryId != null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 12),
      child: Row(
        children: [
          IconButton(
            tooltip: widget.text.get('back'),
            onPressed: widget.onBack,
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          Expanded(
            child: Container(
              height: 52,
              decoration: BoxDecoration(
                color: palette.surfaceDeep,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: palette.primary.withValues(alpha: 0.75),
                ),
                boxShadow: [
                  BoxShadow(
                    color: palette.primary.withValues(alpha: 0.12),
                    blurRadius: 14,
                  ),
                ],
              ),
              child: TextField(
                controller: _input,
                onChanged: _onQueryChanged,
                // 点击结果区域时收起键盘，保证最佳匹配与列表可完整查看。
                onTapOutside: (_) => FocusScope.of(context).unfocus(),
                onSubmitted: (value) {
                  _debounce?.cancel();
                  _applyQuery(value);
                },
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: widget.text.get('searchExample'),
                  hintStyle: TextStyle(color: palette.muted),
                  prefixIcon: Icon(
                    Icons.search_rounded,
                    color: palette.primary,
                  ),
                  suffixIcon: _input.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: widget.text.get('clearSearch'),
                          onPressed: _clearQuery,
                          icon: const Icon(Icons.cancel_outlined),
                        ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 15),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Badge(
            isLabelVisible: hasFilters,
            child: IconButton.outlined(
              tooltip: widget.text.get('filterOptions'),
              onPressed: _openFilters,
              icon: const Icon(Icons.tune_rounded),
            ),
          ),
        ],
      ),
    );
  }

  // 最佳匹配使用当前搜索结果第一条，避免额外请求和虚构推荐。
  Widget _bestMatch(BuildContext context, Station station) {
    final palette = AetherPalette.of(context);
    final details = [
      station.country,
      station.language,
      station.codec,
    ].whereType<String>().where((value) => value.isNotEmpty).join(' · ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.verified_outlined, color: palette.primary, size: 20),
            const SizedBox(width: 8),
            Text(
              widget.text.get('bestMatch'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: palette.surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: palette.border),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  StationArtwork(station: station, size: 108),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          details,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: palette.muted, fontSize: 12),
                        ),
                        const SizedBox(height: 7),
                        Text(
                          station.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'PlusJakartaSans',
                            fontSize: 21,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (station.votes != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            '${station.votes} ${widget.text.get('voteCount')}',
                            style: TextStyle(color: palette.live, fontSize: 12),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Divider(color: palette.border, height: 1),
              const SizedBox(height: 14),
              Row(
                children: [
                  Icon(
                    Icons.graphic_eq_rounded,
                    color: palette.primary,
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    widget.text.get('online'),
                    style: TextStyle(color: palette.primary, fontSize: 12),
                  ),
                  const Spacer(),
                  ListenableBuilder(
                    listenable: widget.library,
                    // 收藏变化时只刷新当前最佳匹配的收藏按钮。
                    builder: (context, child) => IconButton.outlined(
                      tooltip: widget.text.get('favorites'),
                      onPressed: () => widget.library.toggleFavorite(station),
                      icon: Icon(
                        widget.library.isFavorite(station.id)
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.icon(
                    onPressed: () => widget.player.playStation(station),
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: Text(widget.text.get('listenNow')),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  // 结果列表使用真实封面、国家和票数，播放与收藏操作直接生效。
  Widget _stationRow(BuildContext context, Station station) {
    final palette = AetherPalette.of(context);
    final details = [
      station.country,
      station.language,
      station.codec,
    ].whereType<String>().where((value) => value.isNotEmpty).join(' · ');
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: palette.border),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        child: Row(
          children: [
            StationArtwork(station: station, size: 58),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    station.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'PlusJakartaSans',
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    details,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: palette.muted, fontSize: 12),
                  ),
                  if (station.votes != null)
                    Text(
                      '${station.votes} ${widget.text.get('voteCount')}',
                      style: TextStyle(color: palette.live, fontSize: 11),
                    ),
                ],
              ),
            ),
            IconButton.outlined(
              tooltip: widget.text.get('play'),
              onPressed: () => widget.player.playStation(station),
              icon: Icon(Icons.play_arrow_rounded, color: palette.primary),
            ),
            PopupMenuButton<String>(
              tooltip: widget.text.get('moreActions'),
              icon: Icon(Icons.more_vert_rounded, color: palette.muted),
              // 菜单只提供当前版本已有的本地收藏能力。
              onSelected: (_) => widget.library.toggleFavorite(station),
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'favorite',
                  child: Text(widget.text.get('favorites')),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // 搜索首项显示最佳匹配，其余电台按 Worker 的热门票数顺序展示。
  Widget _results(BuildContext context) {
    final hasBestMatch = _keyword.isNotEmpty && _stations.isNotEmpty;
    final visible = hasBestMatch ? _stations.skip(1).toList() : _stations;
    final palette = AetherPalette.of(context);
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(10, 10, 10, 20),
        itemCount: visible.length + 2,
        // 首项承载标题与最佳匹配，末项承载分页状态。
        itemBuilder: (context, index) {
          if (index == 0) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasBestMatch) _bestMatch(context, _stations.first),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _keyword.isEmpty
                            ? widget.text.get('popularStations')
                            : widget.text.get('matchingStations'),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    Text(
                      widget.text.get('sortPopular'),
                      style: TextStyle(color: palette.primary, fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
            );
          }
          final stationIndex = index - 1;
          if (stationIndex < visible.length) {
            return _stationRow(context, visible[stationIndex]);
          }
          if (_loading) {
            return const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          if (_failed) {
            return Center(
              child: TextButton.icon(
                onPressed: () => _load(),
                icon: const Icon(Icons.refresh),
                label: Text(widget.text.get('retry')),
              ),
            );
          }
          if (_stations.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(28),
              child: Center(child: Text(widget.text.get('empty'))),
            );
          }
          return const SizedBox(height: 8);
        },
      ),
    );
  }

  // 搜索输入固定在上方，结果与最佳匹配在其下方独立滚动。
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _searchHeader(context),
        Expanded(child: _results(context)),
      ],
    );
  }
}
