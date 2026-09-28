import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/api_client.dart';
import '../../core/app_config.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import '../stations/station.dart';
import '../stations/station_library.dart';
import 'globe_message.dart';
import 'map_point.dart';

// 用本地地球页面渲染卫星影像和地形，电台业务仍由 Flutter 处理。
class MapPage extends StatefulWidget {
  const MapPage({
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

  // 创建可保留地球视角和所选电台的页面状态。
  @override
  State<MapPage> createState() => _MapPageState();
}

// 隔离 WebView 通信，并校验地球脚本传回的电台 id。
class _MapPageState extends State<MapPage> {
  final WebViewController _webView = WebViewController();
  final Map<int, MapPoint> _pointsById = {};
  Timer? _loadTimeout;
  bool _globeReady = false;
  bool _pointsLoading = true;
  bool _error = false;
  String _theme = 'dark';
  int? _selectedId;
  Station? _selectedStation;

  // 并行加载本地点位和地球页面，任一方完成后尝试同步数据。
  @override
  void initState() {
    super.initState();
    if (AppConfig.mapTilerKey.isNotEmpty) {
      unawaited(_initializeWebView());
    }
    unawaited(_loadPoints());
  }

  // 外层应用切换主题时，保持当前地球视角并更新地图配色。
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final nextTheme = Theme.of(context).brightness == Brightness.dark
        ? 'dark'
        : 'light';
    if (nextTheme == _theme) return;
    _theme = nextTheme;
    if (_globeReady) {
      unawaited(_runGlobeScript('setTheme', nextTheme));
    }
  }

  // 注册受限的 JS 消息通道，并加载随应用打包的地球资源。
  Future<void> _initializeWebView() async {
    try {
      await _webView.setJavaScriptMode(JavaScriptMode.unrestricted);
      await _webView.setBackgroundColor(const Color(0xFF0E1321));
      await _webView.addJavaScriptChannel(
        'AetherBridge',
        // 只处理经过 GlobeMessage 校验的脚本消息。
        onMessageReceived: (message) => _onGlobeMessage(message.message),
      );
      await _webView.setNavigationDelegate(
        NavigationDelegate(
          // 本地 HTML 加载后才创建 MapTiler 地球实例。
          onPageFinished: (_) => unawaited(_startGlobe()),
          // 子资源失败由地图 SDK 自行处理，主页面失败才展示重试。
          onWebResourceError: (error) {
            if (error.isForMainFrame == true) _showGlobeError();
          },
        ),
      );
      await _webView.loadFlutterAsset('assets/globe/index.html');
    } catch (_) {
      _showGlobeError();
    }
  }

  // 初始化地球；超时用于处理网络或 WebGL 初始化失败但没有错误回调的情况。
  Future<void> _startGlobe() async {
    _loadTimeout?.cancel();
    _loadTimeout = Timer(const Duration(seconds: 30), _showGlobeError);
    try {
      final config = jsonEncode({
        'key': AppConfig.mapTilerKey,
        'theme': _theme,
      });
      await _webView.runJavaScript('window.AetherGlobe.initialize($config);');
    } catch (_) {
      _showGlobeError();
    }
  }

  // 在 isolate 中解析坐标快照，避免大量点位阻塞页面首帧。
  Future<void> _loadPoints() async {
    setState(() {
      _pointsLoading = true;
      _error = false;
    });
    try {
      final raw = await rootBundle.loadString('assets/data/stations.json');
      final points = await compute(MapPoint.parseSnapshot, raw);
      if (!mounted) return;
      setState(() {
        _pointsById
          ..clear()
          ..addEntries(points.map((point) => MapEntry(point.id, point)));
        _pointsLoading = false;
      });
      unawaited(_syncPoints());
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _pointsLoading = false;
        _error = true;
      });
    }
  }

  // 地球和快照都就绪后，一次性把每个有效电台的经纬度传给地球。
  Future<void> _syncPoints() async {
    if (!_globeReady || _pointsLoading || _pointsById.isEmpty) return;
    final stations = _pointsById.values
        .map(
          (point) => {
            'id': point.id,
            'latitude': point.latitude,
            'longitude': point.longitude,
          },
        )
        .toList();
    await _runGlobeScript('setStations', stations);
  }

  // 通过 JSON 编码传参，避免构造可注入的 JavaScript 源码。
  Future<void> _runGlobeScript(String method, Object value) async {
    try {
      await _webView.runJavaScript(
        'window.AetherGlobe.$method(${jsonEncode(value)});',
      );
    } catch (_) {
      _showGlobeError();
    }
  }

  // 只接受页面就绪、错误和当前快照中存在的电台选择消息。
  void _onGlobeMessage(String raw) {
    final message = GlobeMessage.parse(raw);
    if (!mounted || message == null) return;
    switch (message.type) {
      case GlobeMessageType.ready:
        _loadTimeout?.cancel();
        setState(() {
          _globeReady = true;
          _error = false;
        });
        unawaited(_syncPoints());
      case GlobeMessageType.error:
        _showGlobeError();
      case GlobeMessageType.select:
        final point = _pointsById[message.stationId];
        if (point != null) unawaited(_selectPoint(point));
    }
  }

  // 点选后向 Worker 查询详情，用户点击播放按钮时才开始播放。
  Future<void> _selectPoint(MapPoint point) async {
    setState(() {
      _selectedId = point.id;
      _selectedStation = null;
    });
    try {
      final station = await widget.api.stationById(point.id);
      if (!mounted || _selectedId != point.id) return;
      setState(() => _selectedStation = station);
    } catch (_) {
      if (mounted && _selectedId == point.id) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(widget.text.get('loadError'))));
      }
    }
  }

  // 将页面初始化和脚本错误集中转成可重试的地图状态。
  void _showGlobeError() {
    _loadTimeout?.cancel();
    if (!mounted) return;
    setState(() => _error = true);
  }

  // 重新加载本地地球页面，点位快照失败时也重新读取。
  void _retry() {
    setState(() {
      _globeReady = false;
      _error = false;
    });
    if (_pointsById.isEmpty) unawaited(_loadPoints());
    if (AppConfig.mapTilerKey.isNotEmpty) {
      unawaited(_webView.reload());
    }
  }

  // 释放初始化超时计时器，避免离开页面后更新已销毁的状态。
  @override
  void dispose() {
    _loadTimeout?.cancel();
    super.dispose();
  }

  // WebView 占满首页内容区，状态和重试操作由 Flutter 绘制。
  Widget _globe(BuildContext context) {
    final palette = AetherPalette.of(context);
    final hasKey = AppConfig.mapTilerKey.isNotEmpty;
    final statusBarHeight = MediaQuery.paddingOf(context).top;
    return Stack(
      children: [
        Positioned.fill(
          child: ColoredBox(
            color: palette.canvas,
            child: hasKey
                ? WebViewWidget(
                    controller: _webView,
                    // 让原生 WebView 直接接收双指捏合等多点触控手势。
                    gestureRecognizers: {
                      Factory<OneSequenceGestureRecognizer>(
                        // 地球手势优先于 Flutter 外层的手势竞争。
                        () => EagerGestureRecognizer(),
                      ),
                    },
                  )
                : null,
          ),
        ),
        if (_globeReady && _pointsById.isNotEmpty)
          Positioned(
            top: statusBarHeight + 12,
            right: 12,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: palette.surface.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                child: Text(
                  '${_pointsById.length} ${widget.text.get('stations')}',
                  style: TextStyle(color: palette.primary, fontSize: 11),
                ),
              ),
            ),
          ),
        if (!hasKey)
          Center(child: Text(widget.text.get('mapKeyMissing')))
        else if (_error)
          Center(
            child: FilledButton.icon(
              onPressed: _retry,
              icon: const Icon(Icons.refresh),
              label: Text(widget.text.get('retry')),
            ),
          )
        else if (!_globeReady || _pointsLoading)
          const Center(child: CircularProgressIndicator()),
      ],
    );
  }

  // 所选电台显示真实地区和码率，并提供收藏与播放入口。
  Widget _stationCard(BuildContext context) {
    final palette = AetherPalette.of(context);
    final station = _selectedStation;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: palette.border),
      ),
      child: station == null
          ? Row(
              children: [
                Icon(Icons.radio_rounded, color: palette.primary, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _selectedId != null
                        ? widget.text.get('loadingStation')
                        : widget.text.get('tapStation'),
                    style: TextStyle(color: palette.muted),
                  ),
                ),
              ],
            )
          : Row(
              children: [
                StationArtwork(station: station, size: 56),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        station.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        [
                          station.country,
                          station.codec,
                        ].whereType<String>().join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: palette.muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                ListenableBuilder(
                  listenable: widget.library,
                  // 收藏切换时只更新当前电台操作区。
                  builder: (context, child) => IconButton(
                    tooltip: widget.text.get('favorites'),
                    onPressed: () => widget.library.toggleFavorite(station),
                    icon: Icon(
                      widget.library.isFavorite(station.id)
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                    ),
                  ),
                ),
                IconButton.filled(
                  tooltip: widget.text.get('play'),
                  onPressed: () => widget.player.playStation(station),
                  icon: const Icon(Icons.play_arrow_rounded),
                ),
              ],
            ),
    );
  }

  // 地球铺满首页内容区，提示和选中电台卡片悬浮在球体上方。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    final statusBarHeight = MediaQuery.paddingOf(context).top;
    return Stack(
      fit: StackFit.expand,
      children: [
        _globe(context),
        Positioned(
          top: statusBarHeight + 56,
          right: 16,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: palette.surface.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              child: Text(
                widget.text.get('mapHint').toUpperCase(),
                style: TextStyle(
                  color: palette.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
            ),
          ),
        ),
        if (_selectedId != null)
          Positioned(
            left: 16,
            right: 16,
            bottom: 40,
            child: _stationCard(context),
          ),
      ],
    );
  }
}
