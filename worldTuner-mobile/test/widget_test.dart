import 'package:flutter_test/flutter_test.dart';
import 'package:worldtuner_mobile/features/map/map_point.dart';
import 'package:worldtuner_mobile/features/stations/station.dart';

// 验证地图快照仅保留可定位的电台，避免无效经纬度进入地图插件。
void main() {
  test('map snapshot filters invalid positions', () {
    const json = '''
    {"data":[
      {"id":1,"name":"A","geoLat":12.5,"geoLong":45},
      {"id":2,"name":"B","geoLat":91,"geoLong":45},
      {"id":3,"name":"C","geoLat":null,"geoLong":45}
    ]}
    ''';
    final points = MapPoint.parseSnapshot(json);
    expect(points.length, 1);
    expect(points.single.id, 1);
    expect(points.single.latitude, 12.5);
  });

  test('station prefers resolved stream URL', () {
    final station = Station.fromJson({
      'id': 4,
      'name': ' Demo ',
      'url': 'https://example.com/original',
      'urlResolved': 'https://example.com/resolved',
    });
    expect(station.name, 'Demo');
    expect(station.streamUrl, 'https://example.com/resolved');
  });
}
