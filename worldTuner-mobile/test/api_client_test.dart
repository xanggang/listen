import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:worldtuner_mobile/core/api_client.dart';
import 'package:worldtuner_mobile/core/map_snapshot_cache.dart';

// 验证移动端查询参数、新接口响应解析与 HTTP 错误处理契约。
void main() {
  test('stations builds catalog request and reads pagination', () async {
    final client = ApiClient(
      origin: Uri.parse('https://api.example.com'),
      // 使用受控响应检查移动端与 Worker 的查询参数契约。
      client: MockClient((request) async {
        expect(request.url.path, '/api/stations');
        expect(request.url.queryParameters['page'], '2');
        expect(request.url.queryParameters['keyword'], 'jazz');
        expect(
          request.url.queryParameters['languagesId'],
          '0363513228099059703',
        );
        expect(
          request.url.queryParameters['countriesId'],
          '0363513228099059755',
        );
        return http.Response(
          jsonEncode({
            'data': {
              'list': [
                {
                  'id': '0363513228099059708',
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
      languageId: '0363513228099059703',
      countryId: '0363513228099059755',
    );
    expect(page.list.single.id, '0363513228099059708');
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
      () => client.stationById('42'),
      throwsA(
        // 断言 HTTP 状态码被保留，供页面区分错误。
        isA<ApiException>().having((error) => error.statusCode, 'status', 404),
      ),
    );
  });
  // 地图页游标和详情均保留真实的 19 位 ID，包含前导零。
  test('map points and detail preserve string ids and cursors', () async {
    const id = '0363513228099059713';
    final client = ApiClient(
      origin: Uri.parse('https://api.example.com'),
      // 模拟新地图页和点选后的详情，校验字符串参数没有精度转换。
      client: MockClient((request) async {
        if (request.url.path == '/api/map/stations') {
          expect(request.url.queryParameters['after'], id);
          return http.Response(
            jsonEncode({
              'data': {
                'list': [
                  {'id': id, 'name': 'Radio', 'geoLat': 30, 'geoLong': 120},
                ],
                'nextCursor': id,
              },
            }),
            200,
          );
        }
        expect(request.url.path, '/api/stations/$id');
        return http.Response(
          jsonEncode({
            'data': {'id': id, 'name': 'Radio', 'url': 'https://radio.test'},
          }),
          200,
        );
      }),
    );
    addTearDown(client.dispose);
    final page = await client.mapPoints(after: id);
    expect(page.list.single.id, id);
    expect(page.nextCursor, id);
    expect((await client.stationById(page.list.single.id)).id, id);
  });
  // 新快照的 longitude/latitude 顺序、ETag 与本地 TTL 共同遵守 HTTP 契约。
  test(
    'map snapshot persists, revalidates with 304 and keeps independent points',
    () async {
      const id = '0363513228099059713';
      final store = MemorySnapshotCache();
      var calls = 0;
      final transport = MockClient(
        // 首次下载无缓存头，第二次需验证 ETag，304 后可直接使用本地缓存。
        (request) async {
          expect(request.url.path, '/api/map/snapshot');
          expect(request.url.query, '');
          calls++;
          if (calls == 1) {
            expect(request.headers['If-None-Match'], isNull);
            return http.Response(
              jsonEncode({
                'data': {
                  'count': 2,
                  'points': [
                    [id, 'Radio', -87.90647, 43.03890],
                    ['0363513228099059714', 'Radio 2', -87.90647, 43.03890],
                  ],
                },
              }),
              200,
              headers: {
                'etag': 'W/"snapshot"',
                'cache-control': 'public, max-age=0',
              },
            );
          }
          expect(request.headers['If-None-Match'], 'W/"snapshot"');
          return http.Response(
            '',
            304,
            headers: {
              'etag': 'W/"snapshot"',
              'cache-control': 'public, max-age=300',
            },
          );
        },
      );
      final client = ApiClient(
        origin: Uri.parse('https://api.example.com'),
        client: transport,
        snapshotCache: store,
      );
      addTearDown(client.dispose);
      final first = await client.mapSnapshot();
      expect(first.length, 2);
      expect(first.first.id, id);
      expect(first.first.longitude, -87.90647);
      expect(first.first.latitude, 43.03890);
      expect((await client.mapSnapshot()).first.id, id);
      expect((await client.mapSnapshot()).length, 2);
      expect(calls, 2);
      final reopened = ApiClient(
        origin: client.origin,
        // 有效的持久缓存必须避免网络下载。
        client: MockClient((_) async => throw StateError('Unexpected request')),
        snapshotCache: store,
      );
      addTearDown(reopened.dispose);
      expect((await reopened.mapSnapshot()).first.id, id);
    },
  );

  // 过期损坏正文不能携带 ETag，否则服务器 304 会导致地图永远无法恢复。
  test('corrupt expired snapshot is downloaded again without ETag', () async {
    final store = MemorySnapshotCache()
      ..entry = CachedMapSnapshot(
        body: '{}',
        etag: 'W/"bad"',
        expiresAt: DateTime.fromMillisecondsSinceEpoch(0),
      );
    final client = ApiClient(
      origin: Uri.parse('https://api.example.com'),
      snapshotCache: store,
      // 错误缓存按未命中处理，完整重新下载。
      client: MockClient((request) async {
        expect(request.headers['If-None-Match'], isNull);
        return http.Response('{"data":{"count":0,"points":[]}}', 200);
      }),
    );
    addTearDown(client.dispose);
    expect(await client.mapSnapshot(), isEmpty);
  });
}

// 测试只在内存保存快照，不访问设备目录。
class MemorySnapshotCache implements MapSnapshotCache {
  CachedMapSnapshot? entry;
  // 返回上一次持久化内容，模拟重启后的读取。
  @override
  Future<CachedMapSnapshot?> read(Uri origin) async => entry;
  // 保存服务器正文和验证器供下次请求使用。
  @override
  Future<void> write(Uri origin, CachedMapSnapshot snapshot) async {
    entry = snapshot;
  }
}
