import 'dart:convert';
import '../stations/station.dart';

// WebView 只允许把地图就绪、错误和有效电台 id 送回 Flutter。
enum GlobeMessageType { ready, error, select }

// 验证本地地球脚本的消息，避免未经检查的 JS 数据进入业务层。
class GlobeMessage {
  // 保存已验证的消息类别及可选电台 id。
  const GlobeMessage(this.type, {this.stationId});

  final GlobeMessageType type;
  final String? stationId;

  // 解析 JavaScript channel 文本；未知类型和非法 id 均被忽略。
  static GlobeMessage? parse(String raw) {
    try {
      final value = jsonDecode(raw);
      if (value is! Map<String, dynamic>) return null;
      return switch (value['type']) {
        'ready' => const GlobeMessage(GlobeMessageType.ready),
        'error' => const GlobeMessage(GlobeMessageType.error),
        'select' => GlobeMessage(
          GlobeMessageType.select,
          stationId: parseEntityId(value['id']),
        ),
        _ => null,
      };
    } catch (_) {
      return null;
    }
  }
}
