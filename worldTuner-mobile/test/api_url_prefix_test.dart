import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:worldtuner_mobile/core/api_client.dart';

// 验证服务地址包含代理前缀时，API 客户端保留完整路径。
void main() {
  // 使用国家字典请求验证代理前缀与 /api 各出现一次。
  test('API client preserves service prefix', () async {
    final origin = Uri.parse('https://api.example.com/service');
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
        'https://api.example.com/service/api/countries?limit=1000',
      );
    } finally {
      api.dispose();
    }
  });
}
