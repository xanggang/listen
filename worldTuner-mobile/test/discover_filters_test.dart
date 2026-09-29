import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:worldtuner_mobile/core/aether_theme.dart';
import 'package:worldtuner_mobile/core/aether_widgets.dart';
import 'package:worldtuner_mobile/core/api_client.dart';
import 'package:worldtuner_mobile/core/app_text.dart';
import 'package:worldtuner_mobile/features/player/player_controller.dart';
import 'package:worldtuner_mobile/features/stations/discover_page.dart';
import 'package:worldtuner_mobile/features/stations/station_library.dart';

// 页面测试不触发音频播放，只验证分类交互与 API 查询参数。
class _UnusedPlayer extends Fake implements PlayerController {}

// 空电台列表不会访问本地收藏，避免测试依赖设备存储。
class _UnusedLibrary extends Fake implements StationLibrary {}

// 验证三个发现分类都能把选中的字典 id 交给电台列表请求。
void main() {
  testWidgets('discover filters send genre, country and language ids', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(900, 844);
    tester.view.devicePixelRatio = 1;
    // 测试结束时恢复视口，不影响其他页面用例。
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final requests = <Uri>[];
    final api = ApiClient(
      origin: Uri.parse('https://api.example.com'),
      // 提供独立字典和空电台页，记录实际发送给 Worker 的请求。
      client: MockClient((request) async {
        requests.add(request.url);
        final item = switch (request.url.pathSegments.last) {
          'tags' => {'id': 11, 'name': 'Rock', 'stationcount': 8},
          'countries' => {'id': 22, 'name': 'Japan', 'stationcount': 9},
          'languages' => {'id': 33, 'name': 'Japanese', 'stationcount': 10},
          _ => null,
        };
        return http.Response(
          jsonEncode({
            'data': item == null
                ? {'list': <Object>[], 'hasMore': false, 'nextPage': null}
                : request.url.pathSegments.last == 'tags'
                ? [
                    // Rock 不在默认展示的前 30 项，必须通过分类搜索找到。
                    for (var index = 0; index < 30; index++)
                      {'id': index + 100, 'name': 'Genre $index'},
                    item,
                  ]
                : [item],
          }),
          200,
        );
      }),
    );
    addTearDown(api.dispose);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAetherTheme(Brightness.light),
        home: Scaffold(
          body: DiscoverPage(
            api: api,
            player: _UnusedPlayer(),
            library: _UnusedLibrary(),
            text: const AppText('en'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget);

    // 依次切换顶部分类并点选真实字典项，核对请求使用对应 id。
    for (final (category, item, parameter, id) in [
      ('Genres', 'Rock', 'tagsId', '11'),
      ('Countries', 'Japan', 'countriesId', '22'),
      ('Languages', 'Japanese', 'languagesId', '33'),
    ]) {
      await tester.tap(find.widgetWithText(AetherFilterChip, category));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsOneWidget);
      if (category == 'Genres') {
        // 本地分类搜索能找到未出现在热门选项中的字典项。
        await tester.enterText(
          find.widgetWithText(
            TextField,
            'Search genres, countries or languages',
          ),
          'Rock',
        );
        await tester.pumpAndSettle();
      }
      await tester.tap(find.widgetWithText(AetherFilterChip, item));
      await tester.pumpAndSettle();
      expect(
        requests
            .lastWhere((uri) => uri.path == '/api/v1/stations')
            .queryParameters[parameter],
        id,
      );
    }

    // 再次点击选中项会清除该类别过滤。
    await tester.tap(find.widgetWithText(AetherFilterChip, 'Japanese'));
    await tester.pumpAndSettle();
    expect(
      requests
          .lastWhere((uri) => uri.path == '/api/v1/stations')
          .queryParameters
          .containsKey('languagesId'),
      isFalse,
    );
    expect(tester.takeException(), isNull);
  });
}
