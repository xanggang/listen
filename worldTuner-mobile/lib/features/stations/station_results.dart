import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import 'station.dart';

// 可复用的分页列表，供发现页和三种榜单筛选共用。
class StationResults extends StatefulWidget {
  const StationResults({
    super.key,
    required this.api,
    required this.player,
    required this.text,
    this.keyword,
    this.languageId,
    this.tagId,
  });

  final ApiClient api;
  final PlayerController player;
  final AppText text;
  final String? keyword;
  final int? languageId;
  final int? tagId;

  @override
  State<StationResults> createState() => _StationResultsState();
}

// 维护列表的请求代次，防止快速切换筛选后显示旧请求结果。
class _StationResultsState extends State<StationResults> {
  final ScrollController _scroll = ScrollController();
  final List<Station> _stations = [];
  int? _nextPage = 1;
  int _generation = 0;
  bool _loading = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  // 滚动接近底部时请求下一页，避免重复触发。
  void _onScroll() {
    if (_scroll.hasClients && _scroll.position.extentAfter < 320) {
      _load();
    }
  }

  // 加载当前页；失败保留页码供重试，刷新则重新从第一页开始。
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
      );
      if (!mounted || version != _generation) return;
      setState(() {
        final seen = _stations.map((station) => station.id).toSet();
        _stations.addAll(result.list.where((station) => seen.add(station.id)));
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

  // 使异步结果失效，并释放滚动控制器。
  @override
  void dispose() {
    _generation++;
    _scroll.dispose();
    super.dispose();
  }

  // 按当前加载状态绘制列表、错误重试和末页提示。
  @override
  Widget build(BuildContext context) {
    final t = widget.text.get;
    return RefreshIndicator(
      onRefresh: () => _load(refresh: true),
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
        itemCount: _stations.length + 1,
        itemBuilder: (context, index) {
          if (index < _stations.length) {
            final station = _stations[index];
            return StationTile(
              station: station,
              onPlay: () => widget.player.playStation(station),
            );
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
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: Text(t('retry')),
              ),
            );
          }
          if (_stations.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(36),
              child: Center(child: Text(t('empty'))),
            );
          }
          return const SizedBox(height: 16);
        },
      ),
    );
  }
}

// 电台通用卡片，点按后交给全局播放器处理。
class StationTile extends StatelessWidget {
  const StationTile({super.key, required this.station, required this.onPlay});

  final Station station;
  final VoidCallback onPlay;

  // 展示名称、地区、语言、票数和播放入口。
  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme;
    final favicon = Uri.tryParse(station.favicon ?? '');
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      color: color.surfaceContainerLow,
      child: InkWell(
        onTap: onPlay,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: favicon?.hasAuthority == true
                      ? Image.network(
                          favicon.toString(),
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stack) =>
                              const Icon(Icons.radio, size: 28),
                        )
                      : const Icon(Icons.radio, size: 28),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      station.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                            station.country,
                            station.language,
                            if (station.votes != null) '${station.votes} votes',
                          ]
                          .whereType<String>()
                          .where((part) => part.isNotEmpty)
                          .join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.play_circle_fill_rounded, size: 36),
            ],
          ),
        ),
      ),
    );
  }
}
