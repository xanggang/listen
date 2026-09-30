import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:worldtuner_mobile/core/metrics_reporter.dart';

// 验证客户端只发送最小页面访问字段，且本机匿名标识可以复用。
void main() {
  // 每个测试从没有统计标识的设备状态开始。
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('page views reuse an anonymous id and report no user details', () async {
    final payloads = <Map<String, dynamic>>[];
    final reporter = MetricsReporter(
      origin: Uri.parse('http://localhost:8787/'),
      preferences: SharedPreferencesAsync(),
      client: MockClient(
        // 记录上报正文，不访问真实 Worker。
        (request) async {
          expect(request.url.path, '/api/metrics/visit');
          payloads.add(jsonDecode(request.body) as Map<String, dynamic>);
          return http.Response('{"data":{"recorded":true}}', 200);
        },
      ),
    );

    await reporter.trackPage('map');
    await reporter.trackPage('vip');
    await reporter.trackResume();
    expect(payloads, hasLength(2));
    expect(payloads.first.keys.toSet(), {'visitorId', 'source', 'page'});
    expect(payloads.first['source'], 'android');
    expect(payloads.first['visitorId'], payloads.last['visitorId']);
    expect(payloads.last['page'], 'vip');
    reporter.dispose();
  });

  test('network failure never interrupts page navigation', () async {
    final reporter = MetricsReporter(
      origin: Uri.parse('http://localhost:8787'),
      preferences: SharedPreferencesAsync(),
      client: MockClient(
        // 模拟统计 API 不可用，业务页面仍应继续运行。
        (request) async => throw http.ClientException('offline'),
      ),
    );

    await reporter.trackPage('discover');
    reporter.dispose();
  });
}
