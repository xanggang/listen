import 'dart:convert';

// Web 现有地图快照中的最小点位模型；详情始终向 API 查询。
class MapPoint {
  const MapPoint({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
  });

  final int id;
  final String name;
  final double latitude;
  final double longitude;

  // 将 JSON 快照转换为有效点位，跳过无效经纬度。
  static List<MapPoint> parseSnapshot(String raw) {
    final root = jsonDecode(raw) as Map<String, dynamic>;
    final rows = root['data'] as List<dynamic>? ?? const [];
    final points = <MapPoint>[];
    for (final value in rows) {
      if (value is! Map<String, dynamic>) continue;
      final id = value['id'];
      final lat = value['geoLat'];
      final lng = value['geoLong'];
      if (id is! num ||
          lat is! num ||
          lng is! num ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180) {
        continue;
      }
      points.add(
        MapPoint(
          id: id.toInt(),
          name: value['name'] as String? ?? '',
          latitude: lat.toDouble(),
          longitude: lng.toDouble(),
        ),
      );
    }
    return points;
  }
}
