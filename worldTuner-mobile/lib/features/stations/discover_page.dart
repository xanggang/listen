import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import 'station_results.dart';

// 对应 Web 发现页，关键词防抖后从 API 重新获取第一页。
class DiscoverPage extends StatefulWidget {
  const DiscoverPage({
    super.key,
    required this.api,
    required this.player,
    required this.text,
  });

  final ApiClient api;
  final PlayerController player;
  final AppText text;

  @override
  State<DiscoverPage> createState() => _DiscoverPageState();
}

// 保存输入框状态与防抖计时器，不把尚未提交的文字发往 API。
class _DiscoverPageState extends State<DiscoverPage> {
  final TextEditingController _input = TextEditingController();
  Timer? _debounce;
  String _keyword = '';

  // 用户停顿 500 毫秒后应用关键词，控制搜索请求量。
  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _keyword = value.trim());
    });
  }

  // 取消待发送的关键词并释放输入控制器。
  @override
  void dispose() {
    _debounce?.cancel();
    _input.dispose();
    super.dispose();
  }

  // 绘制搜索入口和共用电台列表。
  @override
  Widget build(BuildContext context) {
    final t = widget.text.get;
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
            child: Text(
              t('discover'),
              style: Theme.of(
                context,
              ).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _input,
              onChanged: _onChanged,
              onSubmitted: (value) {
                _debounce?.cancel();
                setState(() => _keyword = value.trim());
              },
              decoration: InputDecoration(
                hintText: t('searchHint'),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _input.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _input.clear();
                          _onChanged('');
                          setState(() {});
                        },
                      ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 10),
            child: Text(
              t('trending'),
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          Expanded(
            child: StationResults(
              key: ValueKey(_keyword),
              api: widget.api,
              player: widget.player,
              text: widget.text,
              keyword: _keyword,
            ),
          ),
        ],
      ),
    );
  }
}
