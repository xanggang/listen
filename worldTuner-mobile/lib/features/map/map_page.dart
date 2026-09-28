import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_marker_cluster/flutter_map_marker_cluster.dart';
import 'package:latlong2/latlong.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/api_client.dart';
import '../../core/app_config.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import '../stations/station.dart';
import '../stations/station_library.dart';
import 'map_point.dart';

// 将 Web 现有点位快照绘制成设计稿中的圆形电台探索视图。
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

  // 创建可保留缩放和所选电台的地图状态。
  @override
  State<MapPage> createState() => _MapPageState();
}

// 地图点位解析与 API 详情查询分离，点选不自动开始播放。
class _MapPageState extends State<MapPage> {
  final MapController _map = MapController();
  List<Marker> _markers = const [];
  bool _loading = true;
  bool _error = false;
  int? _selectedId;
  Station? _selectedStation;
  int _pointCount = 0;

  // 首次进入时在后台解析地图快照。
  @override
  void initState() {
    super.initState();
    _loadPoints();
  }

  // 在 isolate 中过滤坏坐标，完成后只生成一次地图标记。
  Future<void> _loadPoints() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final raw = await rootBundle.loadString('assets/data/stations.json');
      final points = await compute(MapPoint.parseSnapshot, raw);
      if (!mounted) return;
      setState(() {
        _pointCount = points.length;
        _markers = points
            .map(
              (point) => Marker(
                point: LatLng(point.latitude, point.longitude),
                width: 26,
                height: 26,
                child: Semantics(
                  label: point.name,
                  button: true,
                  child: GestureDetector(
                    onTap: () => _selectPoint(point),
                    child: Center(
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: const Color(0xFF00D4EC),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x9900D4EC),
                              blurRadius: 8,
                              spreadRadius: 3,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            )
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  // 点选坐标后从 Worker 加载完整详情，并移到地图中心。
  Future<void> _selectPoint(MapPoint point) async {
    _map.move(LatLng(point.latitude, point.longitude), 5);
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

  // 清理地图控制器持有的瓦片和手势资源。
  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  // 根据主题创建可缩放的圆形地图及聚合标记。
  Widget _globe(BuildContext context, double diameter) {
    final palette = AetherPalette.of(context);
    final key = AppConfig.mapTilerKey;
    return SizedBox(
      width: diameter,
      height: diameter,
      child: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: palette.primary.withValues(alpha: 0.18),
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: ClipOval(
                child: FlutterMap(
                  mapController: _map,
                  options: const MapOptions(
                    initialCenter: LatLng(35.6844, 139.753),
                    initialZoom: 1.8,
                    minZoom: 1,
                    maxZoom: 16,
                  ),
                  children: [
                    if (key.isNotEmpty)
                      TileLayer(
                        urlTemplate:
                            'https://api.maptiler.com/maps/satellite-v4/256/{z}/{x}/{y}.jpg?key=${Uri.encodeQueryComponent(key)}',
                        userAgentPackageName: 'app.worldtuner.mobile',
                      ),
                    if (_markers.isNotEmpty)
                      MarkerClusterLayerWidget(
                        options: MarkerClusterLayerOptions(
                          maxClusterRadius: 38,
                          size: const Size(34, 34),
                          markers: _markers,
                          // 聚合数字使用主题重音色，不隐藏底图。
                          builder: (context, markers) => CircleAvatar(
                            backgroundColor: palette.primary,
                            child: Text(
                              '${markers.length}',
                              style: TextStyle(
                                color: palette.onPrimary,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          IgnorePointer(
            child: Center(
              child: Container(
                width: diameter - 24,
                height: diameter - 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: palette.primary.withValues(alpha: 0.4),
                    width: 1.5,
                  ),
                ),
              ),
            ),
          ),
          if (_loading) const Center(child: CircularProgressIndicator()),
          if (_error)
            Center(
              child: FilledButton.icon(
                onPressed: _loadPoints,
                icon: const Icon(Icons.refresh),
                label: Text(widget.text.get('retry')),
              ),
            ),
        ],
      ),
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

  // 按可用高度收缩球体，保证底部详情卡在小屏设备上仍可操作。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return LayoutBuilder(
      // 依照当前屏幕高度限制圆形地图，避免与播放器和导航重叠。
      builder: (context, constraints) {
        final diameter = (constraints.maxWidth - 20)
            .clamp(180.0, constraints.maxHeight * 0.62)
            .toDouble();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
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
              const Spacer(),
              _globe(context, diameter),
              const SizedBox(height: 16),
              Text(
                _pointCount > 0
                    ? '$_pointCount ${widget.text.get('stations')}'
                    : widget.text.get('mapLoading'),
                style: TextStyle(color: palette.muted, fontSize: 12),
              ),
              const Spacer(),
              if (AppConfig.mapTilerKey.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    widget.text.get('mapKeyMissing'),
                    style: TextStyle(color: palette.muted, fontSize: 12),
                  ),
                ),
              _stationCard(context),
              const SizedBox(height: 4),
            ],
          ),
        );
      },
    );
  }
}
