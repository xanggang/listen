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
