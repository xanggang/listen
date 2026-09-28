import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:worldtuner_mobile/core/api_client.dart';

// 验证移动端查询参数、v1 响应解析与 HTTP 错误处理契约。
void main() {
  test('stations builds v1 request and reads pagination', () async {
    final client = ApiClient(
      origin: Uri.parse('https://api.example.com'),
      // 使用受控响应检查移动端与 Worker 的查询参数契约。
      client: MockClient((request) async {
        expect(request.url.path, '/api/v1/stations');
        expect(request.url.queryParameters['page'], '2');
        expect(request.url.queryParameters['keyword'], 'jazz');
        expect(request.url.queryParameters['languagesId'], '3');
        expect(request.url.queryParameters['countriesId'], '55');
        return http.Response(
          jsonEncode({
            'data': {
              'list': [
                {
                  'id': 8,
                  'name': 'Jazz FM',
                  'url': 'https://example.com/stream',
                },
              ],
              'hasMore': true,
              'nextPage': 3,
            },
          }),
          200,
        );
      }),
    );
    addTearDown(client.dispose);
    final page = await client.stations(
      page: 2,
      keyword: ' jazz ',
      languageId: 3,
      countryId: 55,
    );
    expect(page.list.single.id, 8);
    expect(page.nextPage, 3);
  });

  test('non-success response surfaces API status', () async {
    final client = ApiClient(
      origin: Uri.parse('https://api.example.com'),
      client: MockClient(
        // 模拟电台详情不存在时的 Worker 错误响应。
        (request) async => http.Response(
          jsonEncode({
            'error': {'message': 'Station not found'},
          }),
          404,
        ),
      ),
    );
    addTearDown(client.dispose);
    expect(
      () => client.stationById(42),
      throwsA(
        // 断言 HTTP 状态码被保留，供页面区分错误。
        isA<ApiException>().having((error) => error.statusCode, 'status', 404),
      ),
    );
  });
}
