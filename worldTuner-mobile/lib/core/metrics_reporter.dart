import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// 仅上报匿名页面访问，不读取电台、搜索或用户输入。
class MetricsReporter {
  // API 地址与偏好存储由启动流程注入；测试可替换 HTTP 客户端。
  MetricsReporter({
    required this.origin,
    required this.preferences,
    http.Client? client,
  }) : _client = client ?? http.Client();

  static const _visitorKey = 'metrics_anonymous_visitor_id';
  final Uri origin;
  final SharedPreferencesAsync preferences;
  final http.Client _client;
  Future<String>? _visitorId;
  String _currentPage = 'map';
  DateTime? _lastVisit;

  // 生成本机随机 UUID；它不包含设备号、账号或网络地址。
  String _newVisitorId() {
    final random = Random.secure();
    // 使用安全随机数生成 16 字节，并设置 UUID v4 的版本位。
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  // 首次使用时在本机保存匿名标识，后续页面复用它计算 UV。
  Future<String> _loadVisitorId() async {
    final saved = await preferences.getString(_visitorKey);
    if (saved != null) return saved;
    final created = _newVisitorId();
    await preferences.setString(_visitorKey, created);
    return created;
  }

  // 将固定页面名发送到 Worker；网络或存储失败不会影响应用功能。
  Future<void> trackPage(String page) async {
    _currentPage = page;
    _lastVisit = DateTime.now();
    try {
      final visitorId = await (_visitorId ??= _loadVisitorId());
      final prefix = origin.path.replaceAll(RegExp(r'/$'), '');
      final uri = origin.replace(path: '$prefix/api/metrics/visit');
      await _client
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'visitorId': visitorId,
              'source': 'android',
              'page': page,
            }),
          )
          .timeout(const Duration(seconds: 3));
    } catch (_) {
      _visitorId = null;
    }
  }

  // 长时间后台恢复或跨 UTC 日期时，记一次当前页面访问。
  Future<void> trackResume() async {
    final previous = _lastVisit;
    final now = DateTime.now();
    if (previous == null ||
        now.difference(previous) >= const Duration(minutes: 30) ||
        now.toUtc().toIso8601String().substring(0, 10) !=
            previous.toUtc().toIso8601String().substring(0, 10)) {
      await trackPage(_currentPage);
    }
  }

  // 应用关闭时释放统计专用 HTTP 连接。
  void dispose() => _client.close();
}
