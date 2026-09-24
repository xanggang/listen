import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_marker_cluster/flutter_map_marker_cluster.dart';
import 'package:latlong2/latlong.dart';

import '../../core/api_client.dart';
import '../../core/app_config.dart';
import '../../core/app_text.dart';
import '../player/player_controller.dart';
import 'map_point.dart';

// 复用 Web 点位快照显示全球电台；底图密钥由构建环境提供。
class MapPage extends StatefulWidget {
  const MapPage({
    super.key,
    required this.api,
    required this.player,
    required this.text,
  });

  final ApiClient api;
  final PlayerController player;
  final AppText text;

  @override
  State<MapPage> createState() => _MapPageState();
}

// 只在首次进入时解析快照与生成聚合标记，避免每次重建 9200 个标记。
class _MapPageState extends State<MapPage> {
  final MapController _map = MapController();
  List<Marker> _markers = const [];
  bool _loading = true;
  bool _error = false;
  int? _selectedId;

  @override
  void initState() {
    super.initState();
    _loadPoints();
  }

  // 在后台 isolate 解析 JSON，防止大量地图点位阻塞首帧。
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
        _markers = points
            .map(
              (point) => Marker(
                point: LatLng(point.latitude, point.longitude),
                width: 32,
                height: 32,
                child: Semantics(
                  label: point.name,
                  button: true,
                  child: GestureDetector(
                    onTap: () => _selectPoint(point),
                    child: const DecoratedBox(
                      decoration: BoxDecoration(
                        color: Color(0xFF69DB7C),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.radio,
                        size: 17,
                        color: Color(0xFF133626),
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

  // 点选地图坐标后从 API 获取实时电台详情，再交给全局播放器。
  Future<void> _selectPoint(MapPoint point) async {
    _map.move(LatLng(point.latitude, point.longitude), 5);
    setState(() => _selectedId = point.id);
    try {
      final station = await widget.api.stationById(point.id);
      if (!mounted || _selectedId != point.id) return;
      await widget.player.playStation(station);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(widget.text.get('loadError')),
            action: SnackBarAction(
              label: widget.text.get('retry'),
              onPressed: () => _selectPoint(point),
            ),
          ),
        );
      }
    } finally {
      if (mounted && _selectedId == point.id) {
        setState(() => _selectedId = null);
      }
    }
  }

  // 释放地图控制器。
  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  // 绘制卫星底图、点位聚合和加载状态。
  @override
  Widget build(BuildContext context) {
    final key = AppConfig.mapTilerKey;
    return Stack(
      children: [
        ColoredBox(
          color: const Color(0xFF122426),
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
                    maxClusterRadius: 52,
                    size: const Size(42, 42),
                    markers: _markers,
                    builder: (context, markers) => CircleAvatar(
                      backgroundColor: const Color(0xFF69DB7C),
                      child: Text(
                        '${markers.length}',
                        style: const TextStyle(
                          color: Color(0xFF133626),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Align(
              alignment: Alignment.topLeft,
              child: Material(
                color: Theme.of(
                  context,
                ).colorScheme.surface.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(16),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  child: Text(
                    'WorldTuner · ${widget.text.get('map')}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (key.isEmpty)
          Positioned(
            left: 16,
            right: 16,
            bottom: 20,
            child: Material(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(widget.text.get('mapKeyMissing')),
              ),
            ),
          ),
        if (_loading || _selectedId != null)
          const Center(child: CircularProgressIndicator()),
        if (_error)
          Center(
            child: FilledButton.icon(
              onPressed: _loadPoints,
              icon: const Icon(Icons.refresh),
              label: Text(widget.text.get('retry')),
            ),
          ),
        if (key.isNotEmpty)
          const Positioned(
            right: 8,
            bottom: 4,
            child: Text(
              '© MapTiler',
              style: TextStyle(
                color: Colors.white,
                shadows: [Shadow(blurRadius: 3)],
              ),
            ),
          ),
      ],
    );
  }
}
