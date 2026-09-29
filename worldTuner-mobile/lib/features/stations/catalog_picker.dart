import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_text.dart';
import 'station.dart';

// 标签由 API 分页搜索；国家和语言一次加载后在本地查找。
class CatalogPicker extends StatefulWidget {
  const CatalogPicker({
    super.key,
    required this.api,
    required this.text,
    required this.kind,
    required this.title,
    required this.selectedId,
    required this.onSelected,
    required this.onClear,
  });

  final ApiClient api;
  final AppText text;
  final String kind;
  final String title;
  final int? selectedId;
  final ValueChanged<CatalogItem> onSelected;
  final VoidCallback onClear;

  // 创建搜索状态，并在面板关闭时释放输入与分页资源。
  @override
  State<CatalogPicker> createState() => _CatalogPickerState();
}

// 请求代次阻止快速输入时旧页面覆盖新关键词的结果。
class _CatalogPickerState extends State<CatalogPicker> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  final List<CatalogItem> _items = [];
  Timer? _debounce;
  String _query = '';
  String? _letter;
  int _offset = 0;
  int _generation = 0;
  bool _hasMore = true;
  bool _loading = false;
  bool _failed = false;

  // 首次打开时读取热门标签或完整的国家、语言字典。
  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    unawaited(_load());
  }

  // 标签列表接近底部时按 offset 加载下一页；本地字典不翻页。
  void _onScroll() {
    if (widget.kind == 'tags' &&
        _scroll.hasClients &&
        _scroll.position.extentAfter < 260) {
      unawaited(_load());
    }
  }

  // 国家与语言本地过滤；标签输入稳定后发起新的分页搜索。
  void _onChanged(String value) {
    if (widget.kind != 'tags') {
      setState(() {
        _query = value.trim().toLowerCase();
        _letter = null;
      });
      return;
    }
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      _query = value.trim();
      unawaited(_load(reset: true));
    });
  }

  // 加载当前分类；标签一次取 30 项，其余字典按名称排序后保存在内存。
  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _generation++;
      _offset = 0;
      _hasMore = true;
      _items.clear();
      if (_scroll.hasClients) _scroll.jumpTo(0);
    }
    if ((_loading && !reset) || !_hasMore) return;
    final generation = _generation;
    final offset = _offset;
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final page = widget.kind == 'tags'
          ? await widget.api.searchTags(keyword: _query, offset: offset)
          : await widget.api.catalog(widget.kind, limit: 1000);
      if (!mounted || generation != _generation) return;
      setState(() {
        if (widget.kind != 'tags') {
          page.sort(
            // 国家与语言采用字母顺序，便于在完整列表中定位。
            (left, right) =>
                left.name.toLowerCase().compareTo(right.name.toLowerCase()),
          );
        }
        _items.addAll(page);
        _offset += page.length;
        _hasMore = widget.kind == 'tags' && page.length == 30;
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

  // 释放防抖与滚动资源，并使未完成的请求无法更新已关闭的面板。
  @override
  void dispose() {
    _generation++;
    _debounce?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // 选中分类后关闭面板，由发现页统一更新电台列表。
  void _choose(CatalogItem item) {
    widget.onSelected(item);
    Navigator.of(context).pop();
  }

  // 清除当前类别的筛选并关闭面板。
  void _clear() {
    widget.onClear();
    Navigator.of(context).pop();
  }

  // 国家字母索引只筛名称首字母，输入文本时会退出字母筛选。
  void _selectLetter(String letter) {
    _input.clear();
    setState(() {
      _query = '';
      _letter = _letter == letter ? null : letter;
    });
  }

  // 只渲染可见行；加载、空结果和请求失败均有明确反馈。
  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final visible = widget.kind == 'tags'
        ? _items
        : _items
              .where(
                (item) => _letter != null
                    ? item.name.toUpperCase().startsWith(_letter!)
                    : item.name.toLowerCase().contains(query),
              )
              .toList();
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            TextField(
              controller: _input,
              onChanged: _onChanged,
              decoration: InputDecoration(
                hintText: widget.text.get('searchCategories'),
                prefixIcon: const Icon(Icons.search_rounded),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
            if (widget.kind == 'countries') ...[
              const SizedBox(height: 8),
              SizedBox(
                height: 38,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: 26,
                  separatorBuilder: (context, index) =>
                      const SizedBox(width: 4),
                  // 字母按钮跳到对应国家分组，当前字母可再次点按取消。
                  itemBuilder: (context, index) {
                    final letter = String.fromCharCode(65 + index);
                    return ChoiceChip(
                      label: Text(letter),
                      selected: _letter == letter,
                      onSelected: (_) => _selectLetter(letter),
                    );
                  },
                ),
              ),
            ],
            const SizedBox(height: 10),
            Expanded(
              child: ListView.builder(
                controller: _scroll,
                itemCount: visible.length + 2,
                // 首行清除筛选，末行显示分页状态，中间为真实字典项。
                itemBuilder: (context, index) {
                  if (index == 0) {
                    return ListTile(
                      title: Text(widget.text.get('all')),
                      trailing: widget.selectedId == null
                          ? const Icon(Icons.check_rounded)
                          : null,
                      onTap: _clear,
                    );
                  }
                  if (index <= visible.length) {
                    final item = visible[index - 1];
                    return ListTile(
                      title: Text(item.name),
                      subtitle: item.stationCount == null
                          ? null
                          : Text(
                              '${item.stationCount} ${widget.text.get('stationCount')}',
                            ),
                      trailing: widget.selectedId == item.id
                          ? const Icon(Icons.check_rounded)
                          : null,
                      onTap: () => _choose(item),
                    );
                  }
                  if (_loading) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (_failed) {
                    return TextButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh_rounded),
                      label: Text(widget.text.get('loadError')),
                    );
                  }
                  if (visible.isEmpty) {
                    return Center(child: Text(widget.text.get('noCategories')));
                  }
                  return const SizedBox(height: 8);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
