import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:worldtuner_mobile/features/map/map_point.dart';
import 'package:worldtuner_mobile/features/stations/station.dart';

// 验证地图快照仅保留可定位的电台，避免无效经纬度进入地图插件。
void main() {
  // 对外电台 ID 严格校验；分类仍使用原 19 位 ID，不共享短 ID 规则。
  test('station public IDs preserve case and reject old primary keys', () {
    expect(parseStationPublicId('0aB12xY'), '0aB12xY');
    expect(parseStationPublicId('0Ab12Xy'), '0Ab12Xy');
    expect(parseEntityId('0363513228099059713'), '0363513228099059713');
    for (final value in [42, '0363513228099059713', 'bad!123', null]) {
      // 非法 ID 不得进入电台模型或详情请求。
      expect(() => parseStationPublicId(value), throwsFormatException);
    }
  });
  test('map snapshot filters invalid positions', () {
    const json = '''
    {"data":[
      {"id":"0aB12xY","name":"A","geoLat":12.5,"geoLong":45},
      {"id":"0Ab12Xy","name":"B","geoLat":91,"geoLong":45},
      {"id":"Q7r8St9","name":"C","geoLat":null,"geoLong":45}
    ]}
    ''';
    final points = MapPoint.parseRows(
      (jsonDecode(json) as Map<String, dynamic>)['data'] as List<dynamic>,
    );
    expect(points.length, 1);
    expect(points.single.id, '0aB12xY');
    expect(points.single.latitude, 12.5);
  });

  test('station prefers resolved stream URL', () {
    final station = Station.fromJson({
      'id': 'Q7r8St9',
      'name': ' Demo ',
      'url': 'https://example.com/original',
      'urlResolved': 'https://example.com/resolved',
    });
    expect(station.name, 'Demo');
    expect(station.streamUrl, 'https://example.com/resolved');
  });
}
