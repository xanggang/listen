import 'dart:convert';

import '../stations/station.dart';

// API 当前数据源中的轻量点位，详情始终使用相同字符串 ID 查询。
class MapPoint {
  // 保存已验证坐标，避免业务 ID 被 JavaScript 转换成浮点数。
  const MapPoint({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
  });
  final String id;
  final String name;
  final double latitude;
  final double longitude;

  // 在后台 isolate 解码完整元组快照，严格校验计数、字符串 ID 与坐标顺序。
  static List<MapPoint> parseSnapshot(String body) {
    final payload = jsonDecode(body);
    if (payload is! Map<String, dynamic> ||
        payload['data'] is! Map<String, dynamic>) {
      throw const FormatException('Invalid map snapshot');
    }
    final data = payload['data'] as Map<String, dynamic>;
    final rows = data['points'];
    if (rows is! List || data['count'] != rows.length) {
      throw const FormatException('Invalid map count');
    }
    final points = <MapPoint>[];
    final seen = <String>{};
    for (final row in rows) {
      if (row is! List ||
          row.length != 4 ||
          row[0] is! String ||
          !RegExp(r'^\d{19}$').hasMatch(row[0] as String) ||
          row[1] is! String ||
          row[2] is! num ||
          row[3] is! num) {
        throw const FormatException('Invalid map tuple');
      }
      final id = row[0] as String;
      final longitude = (row[2] as num).toDouble();
      final latitude = (row[3] as num).toDouble();
      if (!seen.add(id) ||
          !longitude.isFinite ||
          !latitude.isFinite ||
          longitude.abs() > 180 ||
          latitude.abs() > 90) {
        throw const FormatException('Invalid map coordinates or duplicate ID');
      }
      points.add(
        MapPoint(
          id: id,
          name: row[1] as String,
          latitude: latitude,
          longitude: longitude,
        ),
      );
    }
    return points;
  }

  // 解析单页点位；无效坐标不进入地球数据，非法 ID 由调用方处理为加载错误。
  static List<MapPoint> parseRows(List<dynamic> rows) {
    final points = <MapPoint>[];
    for (final value in rows) {
      if (value is! Map<String, dynamic>) continue;
      final lat = value['geoLat'];
      final lng = value['geoLong'];
      if (lat is! num ||
          lng is! num ||
          !lat.isFinite ||
          !lng.isFinite ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180) {
        continue;
      }
      points.add(
        MapPoint(
          id: parseEntityId(value['id']),
          name: value['name'] as String? ?? '',
          latitude: lat.toDouble(),
          longitude: lng.toDouble(),
        ),
      );
    }
    return points;
  }
}

class MapPointPage {
  // 保留服务器下一页游标，不把 ID 转换为数字或自增页码。
  const MapPointPage({required this.list, this.nextCursor});
  final List<MapPoint> list;
  final String? nextCursor;
}
