import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import 'station.dart';
import 'station_results.dart';

// 全球、语言和流派榜单共用分页接口。
class LeaderboardPage extends StatefulWidget {
  const LeaderboardPage({
    super.key,
    required this.api,
    required this.player,
    required this.text,
  });

  final ApiClient api;
  final PlayerController player;
  final AppText text;

  @override
  State<LeaderboardPage> createState() => _LeaderboardPageState();
}

// 缓存榜单筛选项，切换维度时仅发送可见筛选条件。
class _LeaderboardPageState extends State<LeaderboardPage> {
  int _scope = 0;
  int? _languageId;
  int? _tagId;
  late final Future<List<CatalogItem>> _languages;
  late final Future<List<CatalogItem>> _tags;

  @override
  void initState() {
    super.initState();
    _languages = widget.api.catalog('languages');
    _tags = widget.api.catalog('tags');
  }

  // 绘制语言或流派筛选项；加载失败时仍可切回全球榜单。
  Widget _filterOptions(
    Future<List<CatalogItem>> source,
    int? current,
    ValueChanged<int> onSelected,
  ) {
    return FutureBuilder<List<CatalogItem>>(
      future: source,
      builder: (context, snapshot) {
        if (snapshot.hasError) return Text(widget.text.get('loadError'));
        if (!snapshot.hasData) {
          return const SizedBox(
            height: 42,
            child: Center(child: LinearProgressIndicator()),
          );
        }
        return SizedBox(
          height: 50,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: snapshot.data!
                .map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(item.name),
                      selected: current == item.id,
                      onSelected: (_) => onSelected(item.id),
                    ),
                  ),
                )
                .toList(),
          ),
        );
      },
    );
  }

  // 绘制维度切换、对应分类选项和电台列表。
  @override
  Widget build(BuildContext context) {
    final t = widget.text.get;
    final filter = _scope == 1
        ? _languageId
        : _scope == 2
        ? _tagId
        : null;
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 18),
            child: Text(
              t('charts'),
              style: Theme.of(
                context,
              ).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SegmentedButton<int>(
              showSelectedIcon: false,
              segments: [
                ButtonSegment(value: 0, label: Text(t('global'))),
                ButtonSegment(value: 1, label: Text(t('byLanguage'))),
                ButtonSegment(value: 2, label: Text(t('byGenre'))),
              ],
              selected: {_scope},
              onSelectionChanged: (value) =>
                  setState(() => _scope = value.first),
            ),
          ),
          if (_scope != 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 0, 8),
              child: _scope == 1
                  ? _filterOptions(
                      _languages,
                      _languageId,
                      (id) => setState(() => _languageId = id),
                    )
                  : _filterOptions(
                      _tags,
                      _tagId,
                      (id) => setState(() => _tagId = id),
                    ),
            ),
          const SizedBox(height: 8),
          Expanded(
            child: StationResults(
              key: ValueKey('$_scope:$filter'),
              api: widget.api,
              player: widget.player,
              text: widget.text,
              languageId: _scope == 1 ? _languageId : null,
              tagId: _scope == 2 ? _tagId : null,
            ),
          ),
        ],
      ),
    );
  }
}
