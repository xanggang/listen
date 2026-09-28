import 'package:flutter/material.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/api_client.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import 'station.dart';
import 'station_library.dart';

// 发现页与榜单页共用的分页数据视图，可在列表前嵌入页面内容。
class StationResults extends StatefulWidget {
  const StationResults({
    super.key,
    required this.api,
    required this.player,
    required this.library,
    required this.text,
    this.header,
    this.keyword,
    this.languageId,
    this.tagId,
    this.countryId,
    this.showRank = false,
    this.skipFirst = 0,
  });

  final ApiClient api;
  final PlayerController player;
  final StationLibrary library;
  final AppText text;
  final Widget? header;
  final String? keyword;
  final int? languageId;
  final int? tagId;
  final int? countryId;
  final bool showRank;
  final int skipFirst;

  // 创建带分页与滚动位置的列表状态。
  @override
  State<StationResults> createState() => _StationResultsState();
}

// 请求代次保证切换关键词和分类时不会显示过期结果。
class _StationResultsState extends State<StationResults> {
  final ScrollController _scroll = ScrollController();
  final List<Station> _stations = [];
  int? _nextPage = 1;
  int _generation = 0;
  bool _loading = false;
  bool _failed = false;

  // 首次进入页面时启动第一页请求并监听滚动。
  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  // 接近列表末尾时加载下一页，避免重复并发请求。
  void _onScroll() {
    if (_scroll.hasClients && _scroll.position.extentAfter < 300) {
      _load();
    }
  }

  // 读取当前页，刷新时清空旧记录；失败时保留页码以便重试。
  Future<void> _load({bool refresh = false}) async {
    if (_loading && !refresh) return;
    if (refresh) {
      _generation++;
      _nextPage = 1;
      _stations.clear();
    }
    final page = _nextPage;
    if (page == null) return;
    final version = _generation;
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final result = await widget.api.stations(
        page: page,
        keyword: widget.keyword,
        languageId: widget.languageId,
        tagId: widget.tagId,
        countryId: widget.countryId,
      );
      if (!mounted || version != _generation) return;
      setState(() {
        final seen = _stations.map((station) => station.id).toSet();
        final incoming = page == 1
            ? result.list.skip(widget.skipFirst)
            : result.list;
        _stations.addAll(incoming.where((station) => seen.add(station.id)));
        _nextPage = result.nextPage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted || version != _generation) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  // 释放监听器，并让尚未完成的请求失效。
  @override
  void dispose() {
    _generation++;
    _scroll.dispose();
    super.dispose();
  }

  // 将页面头部、真实电台行及加载/错误状态放入同一滚动区域。
  @override
  Widget build(BuildContext context) {
    final hasHeader = widget.header != null;
    return RefreshIndicator(
      onRefresh: () => _load(refresh: true),
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        itemCount: _stations.length + 1 + (hasHeader ? 1 : 0),
        // 首项可由页面提供设计稿中的特色内容，余项保持分页。
        itemBuilder: (context, index) {
          if (hasHeader && index == 0) return widget.header!;
          final stationIndex = index - (hasHeader ? 1 : 0);
          if (stationIndex < _stations.length) {
            final station = _stations[stationIndex];
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: StationTile(
                station: station,
                library: widget.library,
                text: widget.text,
                rank: widget.showRank
                    ? stationIndex + 1 + widget.skipFirst
                    : null,
                onPlay: () => widget.player.playStation(station),
              ),
            );
          }
          if (_loading) {
            return const Padding(
              padding: EdgeInsets.all(22),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          if (_failed) {
            return Center(
              child: TextButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: Text(widget.text.get('retry')),
              ),
            );
          }
          if (_stations.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(36),
              child: Center(child: Text(widget.text.get('empty'))),
            );
          }
          return const SizedBox(height: 12);
        },
      ),
    );
  }
}

// 设计稿中的电台列表行，支持收藏、排名和直接播放。
class StationTile extends StatelessWidget {
  const StationTile({
    super.key,
    required this.station,
    required this.library,
    required this.text,
    required this.onPlay,
    this.rank,
  });

  final Station station;
  final StationLibrary library;
  final AppText text;
  final VoidCallback onPlay;
  final int? rank;

  // 展示真实 API 元数据，避免用设计稿示意听众数冒充实时数据。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    final details = [
      station.country,
      station.language,
      if (station.votes != null) '${station.votes} ${text.get('voteCount')}',
    ].whereType<String>().where((part) => part.isNotEmpty).join(' · ');
    return Container(
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: palette.border),
      ),
      child: InkWell(
        onTap: onPlay,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              if (rank != null) ...[
                SizedBox(
                  width: 30,
                  child: Text(
                    rank!.toString().padLeft(2, '0'),
                    style: TextStyle(
                      fontFamily: 'PlusJakartaSans',
                      fontWeight: FontWeight.w800,
                      color: palette.text,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
              ],
              StationArtwork(station: station, size: 48),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      station.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      details,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11, color: palette.muted),
                    ),
                  ],
                ),
              ),
              ListenableBuilder(
                listenable: library,
                // 当前电台收藏状态变化时只刷新按钮。
                builder: (context, child) => IconButton(
                  tooltip: text.get('favorites'),
                  constraints: const BoxConstraints(
                    minWidth: 36,
                    minHeight: 36,
                  ),
                  onPressed: () => library.toggleFavorite(station),
                  icon: Icon(
                    library.isFavorite(station.id)
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    size: 19,
                    color: library.isFavorite(station.id)
                        ? const Color(0xFFF43F5E)
                        : palette.muted,
                  ),
                ),
              ),
              IconButton.filledTonal(
                tooltip: text.get('play'),
                onPressed: onPlay,
                icon: const Icon(Icons.play_arrow_rounded, size: 22),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
