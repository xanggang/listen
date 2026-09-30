import 'package:flutter_test/flutter_test.dart';
import 'package:worldtuner_mobile/features/map/globe_message.dart';

// 验证 WebView 消息边界，阻止非法电台 id 进入详情查询。
void main() {
  // 仅接受已定义的状态和有效字符串电台 id。
  test('accepts known messages and positive station ids', () {
    expect(
      GlobeMessage.parse('{"type":"ready"}')?.type,
      GlobeMessageType.ready,
    );
    expect(
      GlobeMessage.parse('{"type":"error"}')?.type,
      GlobeMessageType.error,
    );
    final selected = GlobeMessage.parse(
      '{"type":"select","id":"0363513228099059713"}',
    );
    expect(selected?.type, GlobeMessageType.select);
    expect(selected?.stationId, '0363513228099059713');
  });

  // 拒绝脚本发来的未知结构和不合法 id。
  test('rejects malformed messages and invalid station ids', () {
    for (final raw in [
      'invalid json',
      '[]',
      '{"type":"unknown"}',
      '{"type":"select","id":0}',
      '{"type":"select","id":-1}',
      '{"type":"select","id":"invalid"}',
      '{"type":"select","id":42.5}',
    ]) {
      expect(GlobeMessage.parse(raw), isNull);
    }
  });
}
