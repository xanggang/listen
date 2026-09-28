import 'package:flutter/material.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/api_client.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import 'station.dart';
import 'station_library.dart';
import 'station_results.dart';

// 依据 API 票数排序展示全球、语言和流派榜单。
class LeaderboardPage extends StatefulWidget {
  const LeaderboardPage({
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

  // 创建保留榜单筛选状态的页面。
  @override
  State<LeaderboardPage> createState() => _LeaderboardPageState();
}

// 榜首三台与下方分页列表共用当前 API 筛选条件。
class _LeaderboardPageState extends State<LeaderboardPage> {
  int _scope = 0;
  int? _languageId;
  int? _tagId;
  late final Future<List<CatalogItem>> _languages;
  late final Future<List<CatalogItem>> _tags;
  late Future<StationPage> _topStations;

  // 首次加载分类字典和全球前三电台。
  @override
  void initState() {
    super.initState();
    _languages = widget.api.catalog('languages', limit: 30);
    _tags = widget.api.catalog('tags', limit: 30);
    _topStations = widget.api.stations(pageSize: 3);
  }

  // 切换榜单范围后同步更新前三名数据。
  void _selectScope(int scope) {
    setState(() {
      _scope = scope;
      _reloadTop();
    });
  }

  // 选择语言或流派字典项并刷新前三名。
  void _selectFilter(int id) {
    setState(() {
      if (_scope == 1) {
        _languageId = id;
      } else {
        _tagId = id;
      }
      _reloadTop();
    });
  }

  // 使用当前可见维度重新请求榜首三台。
  void _reloadTop() {
    _topStations = widget.api.stations(
      pageSize: 3,
      languageId: _scope == 1 ? _languageId : null,
      tagId: _scope == 2 ? _tagId : null,
    );
  }

  // 绘制水平滚动的语言或流派过滤器。
  Widget _filterOptions(BuildContext context) {
    final palette = AetherPalette.of(context);
    final source = _scope == 1 ? _languages : _tags;
    final selectedId = _scope == 1 ? _languageId : _tagId;
    return FutureBuilder<List<CatalogItem>>(
      future: source,
      // 分类读取失败时保留全球榜单与重选入口。
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Text(
            widget.text.get('loadError'),
            style: TextStyle(color: palette.muted),
          );
        }
        final items = snapshot.data;
        if (items == null) return const LinearProgressIndicator();
        return SizedBox(
          height: 42,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (context, index) => const SizedBox(width: 8),
            // 当前分类通过 API id 过滤整个榜单。
            itemBuilder: (context, index) {
              final item = items[index];
              return AetherFilterChip(
                label: item.name,
                selected: selectedId == item.id,
                onTap: () => _selectFilter(item.id),
              );
            },
          ),
        );
      },
    );
  }

  // 使用实际票数与名称绘制榜首卡片，不假设实时听众数据。
  Widget _podiumItem(BuildContext context, Station station, int rank) {
    final palette = AetherPalette.of(context);
    final featured = rank == 1;
    return Expanded(
      child: InkWell(
        onTap: () => widget.player.playStation(station),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          height: featured ? 180 : 160,
          padding: const EdgeInsets.fromLTRB(7, 12, 7, 8),
          decoration: BoxDecoration(
            color: palette.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: featured
                  ? palette.primary.withValues(alpha: 0.4)
                  : palette.border,
            ),
          ),
          child: Column(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  StationArtwork(station: station, size: featured ? 58 : 50),
                  Positioned(
                    right: -7,
                    bottom: -4,
                    child: CircleAvatar(
                      radius: 11,
                      backgroundColor: featured
                          ? palette.primary
                          : palette.surfaceRaised,
                      child: Text(
                        '$rank',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: featured ? palette.onPrimary : palette.text,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                station.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                station.country ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 10, color: palette.muted),
              ),
              const Spacer(),
              Text(
                '${station.votes ?? 0} ${widget.text.get('voteCount')}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: featured ? palette.primary : palette.muted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // 首屏三强排序为 2-1-3，保持设计稿的中心突出构图。
  Widget _podium(BuildContext context) {
    return FutureBuilder<StationPage>(
      future: _topStations,
      // 请求失败时显示轻量错误，其余榜单继续单独加载。
      builder: (context, snapshot) {
        final stations = snapshot.data?.list;
        if (stations == null) {
          return SizedBox(
            height: 180,
            child: Center(
              child: snapshot.hasError
                  ? Text(widget.text.get('loadError'))
                  : const CircularProgressIndicator(),
            ),
          );
        }
        if (stations.length < 3) return const SizedBox.shrink();
        return SizedBox(
          height: 186,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _podiumItem(context, stations[1], 2),
              const SizedBox(width: 8),
              _podiumItem(context, stations[0], 1),
              const SizedBox(width: 8),
              _podiumItem(context, stations[2], 3),
            ],
          ),
        );
      },
    );
  }

  // 绘制设计稿中的标题、榜单维度、前三名和正式列表标题。
  Widget _header(BuildContext context) {
    final palette = AetherPalette.of(context);
    final t = widget.text.get;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Text(
          t('globalCharts'),
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        const SizedBox(height: 5),
        Text(
          t('weeklyCharts'),
          style: TextStyle(color: palette.muted, fontSize: 12),
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              AetherFilterChip(
                label: t('filterAll'),
                selected: _scope == 0,
                onTap: () => _selectScope(0),
              ),
              const SizedBox(width: 8),
              AetherFilterChip(
                label: t('filterLanguage'),
                selected: _scope == 1,
                onTap: () => _selectScope(1),
              ),
              const SizedBox(width: 8),
              AetherFilterChip(
                label: t('filterGenre'),
                selected: _scope == 2,
                onTap: () => _selectScope(2),
              ),
            ],
          ),
        ),
        if (_scope != 0) ...[
          const SizedBox(height: 12),
          _filterOptions(context),
        ],
        const SizedBox(height: 24),
        _podium(context),
        const SizedBox(height: 26),
        AetherSectionHeading(title: t('topStations'), subtitle: '4–50'),
        const SizedBox(height: 12),
      ],
    );
  }

  // 把当前榜单条件应用于前三名和后续分页列表。
  @override
  Widget build(BuildContext context) {
    final filter = _scope == 1
        ? _languageId
        : _scope == 2
        ? _tagId
        : null;
    return StationResults(
      key: ValueKey('$_scope:$filter'),
      api: widget.api,
      player: widget.player,
      library: widget.library,
      text: widget.text,
      header: _header(context),
      showRank: true,
      skipFirst: 3,
      languageId: _scope == 1 ? _languageId : null,
      tagId: _scope == 2 ? _tagId : null,
    );
  }
}
