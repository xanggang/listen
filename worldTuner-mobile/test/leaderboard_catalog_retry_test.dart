import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:worldtuner_mobile/core/aether_theme.dart';
import 'package:worldtuner_mobile/core/api_client.dart';
import 'package:worldtuner_mobile/core/app_text.dart';
import 'package:worldtuner_mobile/features/player/player_controller.dart';
import 'package:worldtuner_mobile/features/stations/leaderboard_page.dart';
import 'package:worldtuner_mobile/features/stations/station_library.dart';

// 空榜单不会播放音频或访问收藏，避免测试依赖设备插件。
class _UnusedPlayer extends Fake implements PlayerController {}

class _UnusedLibrary extends Fake implements StationLibrary {}

// 使用真实 API 客户端与页面验证重试、缓存和销毁期间的请求行为。
void main() {
  testWidgets(
    'failed catalogs retry on switching and button, successful catalogs are reused',
    (tester) async {
      final counts = <String, int>{};
      final api = ApiClient(
        origin: Uri.parse('https://api.test'),
        // 两个预加载都失败；语言第二次仍失败，按钮第三次成功，标签第二次成功。
        client: MockClient((request) async {
          final kind = request.url.pathSegments.last;
          if (kind == 'stations') return _emptyStations();
          counts[kind] = (counts[kind] ?? 0) + 1;
          if (counts[kind]! < (kind == 'languages' ? 3 : 2)) {
            return http.Response('{"error":{"message":"Unavailable"}}', 503);
          }
          return http.Response(
            jsonEncode({
              'data': [
                {
                  'id': kind == 'languages'
                      ? '0363513228099059713'
                      : '0363513228099059714',
                  'name': kind == 'languages' ? 'English' : 'Rock',
                },
              ],
            }),
            200,
          );
        }),
      );
      addTearDown(api.dispose);
      await _showPage(tester, api);
      await tester.pumpAndSettle();
      expect(counts, {'languages': 1, 'tags': 1});
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Languages'));
      await tester.pumpAndSettle();
      expect(counts['languages'], 2);
      expect(find.widgetWithText(TextButton, 'Retry'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Retry'));
      await tester.pumpAndSettle();
      expect(counts['languages'], 3);
      expect(find.text('English'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Retry'), findsNothing);

      await tester.tap(find.text('Tags'));
      await tester.pumpAndSettle();
      expect(counts['tags'], 2);
      expect(find.text('Rock'), findsOneWidget);
      await tester.tap(find.text('Languages'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tags'));
      await tester.pumpAndSettle();
      expect(counts, {'languages': 3, 'tags': 2});
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'pending catalog is not duplicated and late failure after disposal is handled',
    (tester) async {
      final pending = Completer<http.Response>();
      var calls = 0;
      final api = ApiClient(
        origin: Uri.parse('https://api.test'),
        // 控制语言请求的完成时间，模拟慢网络和离开页面后的失败。
        client: MockClient((request) async {
          final kind = request.url.pathSegments.last;
          if (kind == 'stations') return _emptyStations();
          if (kind == 'languages') {
            calls++;
            return pending.future;
          }
          return http.Response('{"data":[]}', 200);
        }),
      );
      addTearDown(api.dispose);
      await _showPage(tester, api);
      await tester.pump();
      await tester.tap(find.text('Languages'));
      await tester.pump();
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      await tester.tap(find.text('Tags'));
      await tester.pump();
      await tester.tap(find.text('Languages'));
      await tester.pump();
      expect(calls, 1);
      await tester.pumpWidget(const SizedBox.shrink());
      pending.complete(
        http.Response('{"error":{"message":"Unavailable"}}', 503),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  // 完整面板搜索非热门标签，榜首与分页必须使用同一 ID，清除后恢复全部。
  testWidgets('view all selects and clears a non-popular leaderboard tag', (
    tester,
  ) async {
    final requests = <Uri>[];
    final api = ApiClient(
      origin: Uri.parse('https://api.test'),
      client: MockClient(
        // 快捷列表仅提供 Rock，Ambient 只能通过完整面板搜索获得。
        (request) async {
          requests.add(request.url);
          if (request.url.pathSegments.last == 'stations') {
            return _emptyStations();
          }
          final searched = request.url.queryParameters['q'] == 'Ambient';
          return http.Response(
            jsonEncode({
              'data': [
                {
                  'id': searched
                      ? '0363513228099059715'
                      : '0363513228099059714',
                  'name': searched ? 'Ambient' : 'Rock',
                },
              ],
            }),
            200,
          );
        },
      ),
    );
    addTearDown(api.dispose);
    await _showPage(tester, api);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tags'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('View all'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Ambient');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ListTile, 'Ambient'));
    await tester.pumpAndSettle();
    expect(find.text('Ambient'), findsOneWidget);
    final filtered = requests
        .where(
          // 榜首和下方列表均提交完整选择结果的 ID。
          (uri) =>
              uri.path == '/api/stations' &&
              uri.queryParameters['tagsId'] == '0363513228099059715',
        )
        .toList();
    expect(
      filtered.any(
        // 确认前三名的独立请求也已刷新。
        (uri) => uri.queryParameters['pageSize'] == '3',
      ),
      isTrue,
    );
    expect(filtered.length, greaterThanOrEqualTo(2));
    await tester.tap(find.text('View all'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ListTile, 'All'));
    await tester.pumpAndSettle();
    expect(
      requests
          .lastWhere(
            // 清除后的最新榜单请求不再带标签过滤。
            (uri) => uri.path == '/api/stations',
          )
          .queryParameters['tagsId'],
      isNull,
    );
    expect(tester.takeException(), isNull);
  });

  // 国家榜采用 countriesId，中文名随界面语言展示，完整面板可选非热门国家。
  testWidgets(
    'country leaderboard localizes and shares the filter with podium and list',
    (tester) async {
      final requests = <Uri>[];
      final api = ApiClient(
        origin: Uri.parse('https://api.test'),
        client: MockClient(
          // 国家名称由 API 返回中英文，完整列表额外提供 Japan。
          (request) async {
            requests.add(request.url);
            final kind = request.url.pathSegments.last;
            if (kind == 'stations') return _emptyStations();
            final data = kind == 'countries'
                ? [
                    {
                      'id': '0363513228099059721',
                      'name': 'China',
                      'name_en': 'China',
                      'name_zh': '中国',
                      'code': 'CN',
                    },
                    if (request.url.queryParameters['limit'] == '1000')
                      {
                        'id': '0363513228099059722',
                        'name': 'Japan',
                        'name_en': 'Japan',
                        'name_zh': '日本',
                        'code': 'JP',
                      },
                  ]
                : <Object>[];
            return http.Response(
              jsonEncode({'data': data}),
              200,
              headers: {'content-type': 'application/json; charset=utf-8'},
            );
          },
        ),
      );
      addTearDown(api.dispose);
      await tester.pumpWidget(
        MaterialApp(
          theme: buildAetherTheme(Brightness.light),
          home: Scaffold(
            body: LeaderboardPage(
              api: api,
              player: _UnusedPlayer(),
              library: _UnusedLibrary(),
              text: const AppText('zh'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('国家榜'));
      await tester.tap(find.text('国家榜'));
      await tester.pumpAndSettle();
      expect(find.text('中国'), findsOneWidget);
      await tester.tap(find.text('中国'));
      await tester.pumpAndSettle();
      expect(
        requests
            .where(
              // 榜首与分页列表均按国家 ID 请求，不能误传标签参数。
              (uri) =>
                  uri.path == '/api/stations' &&
                  uri.queryParameters['countriesId'] == '0363513228099059721' &&
                  !uri.queryParameters.containsKey('tagsId'),
            )
            .length,
        greaterThanOrEqualTo(2),
      );
      await tester.tap(find.text('查看全部'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '日本');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ListTile, '日本'));
      await tester.pumpAndSettle();
      expect(find.text('日本'), findsOneWidget);
      expect(
        requests
            .lastWhere(
              // 完整面板选择后新国家立即生效。
              (uri) => uri.path == '/api/stations',
            )
            .queryParameters['countriesId'],
        '0363513228099059722',
      );
      expect(tester.takeException(), isNull);
    },
  );
}

// 空电台页让用例仅关注分类请求，不创建播放器或收藏组件。
http.Response _emptyStations() =>
    http.Response('{"data":{"list":[],"hasMore":false,"nextPage":null}}', 200);

// 使用手机视口和英文主题，验证重试按钮沿用现有语言切换文案。
Future<void> _showPage(WidgetTester tester, ApiClient api) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  // 恢复视口，避免影响其他页面测试。
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAetherTheme(Brightness.dark),
      home: Scaffold(
        body: LeaderboardPage(
          api: api,
          player: _UnusedPlayer(),
          library: _UnusedLibrary(),
          text: const AppText('en'),
        ),
      ),
    ),
  );
}
