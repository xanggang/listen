import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:worldtuner_mobile/core/api_client.dart';

// 检查真实线上环境文件与 API 客户端配合时不会丢失或重复代理路径。
void main() {
  // 使用国家字典请求验证 /client 与 /api 各出现一次。
  test('online environment preserves client API prefix', () async {
    final config =
        jsonDecode(File('env/online.json').readAsStringSync())
            as Map<String, dynamic>;
    final origin = Uri.parse(config['API_BASE_URL'] as String);
    final requests = <Uri>[];
    final api = ApiClient(
      origin: origin,
      client: MockClient(
        // 模拟只读接口并记录请求，不访问线上服务。
        (request) async {
          requests.add(request.url);
          return http.Response(
            '{"data":[]}',
            200,
            headers: {'content-type': 'application/json'},
          );
        },
      ),
    );
    try {
      await api.catalog('countries', limit: 1000);
      expect(
        requests.single.toString(),
        'https://tuner.naxi.fun/client/api/countries?limit=1000',
      );
      expect(config['MAPTILER_API_KEY'], isNotEmpty);
    } finally {
      api.dispose();
    }
  });
}
