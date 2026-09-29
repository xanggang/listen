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

// 验证发现页不再显示分类，独立搜索页仍能按三个字典 id 过滤。
void main() {
  testWidgets('search page owns tag, country and language filters', (
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
                ? request.url.queryParameters['q'] == 'Rock'
                      ? [item]
                      : [
                          // Rock 不在默认展示的快捷项中，必须通过标签搜索找到。
                          for (
                            var index = 0;
                            index <
                                int.parse(
                                  request.url.queryParameters['limit'] ?? '30',
                                );
                            index++
                          )
                            {'id': index + 100, 'name': 'Tag $index'},
                        ]
                : request.url.pathSegments.last == 'countries'
                ? [
                    // 首页只有前 10 项，完整面板含 200 多个可搜索国家。
                    for (
                      var index = 0;
                      index <
                          (request.url.queryParameters['limit'] == '1000'
                              ? 200
                              : 10);
                      index++
                    )
                      {'id': index + 1000, 'name': 'Country $index'},
                    if (request.url.queryParameters['limit'] == '1000') item,
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
    expect(find.widgetWithText(AetherFilterChip, 'Tags'), findsNothing);
    // 发现页保留标签探索卡片，但点按后才进入带预选标签的搜索页。
    await tester.ensureVisible(find.text('Tag 0'));
    await tester.tap(find.text('Tag 0'));
    await tester.pumpAndSettle();
    expect(
      requests
          .lastWhere((uri) => uri.path == '/api/v1/stations')
          .queryParameters['tagsId'],
      '100',
    );
    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    // 点击发现页唯一搜索入口后，分类栏才出现在独立搜索页。
    await tester.tap(find.byType(TextField));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AetherFilterChip, 'Tags'), findsOneWidget);

    // 依次切换搜索分类并点选真实字典项，核对请求使用对应 id。
    for (final (category, item, parameter, id) in [
      ('Tags', 'Rock', 'tagsId', '11'),
      ('Countries', 'Japan', 'countriesId', '22'),
      ('Languages', 'Japanese', 'languagesId', '33'),
    ]) {
      await tester.tap(find.widgetWithText(AetherFilterChip, category));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsOneWidget);
      if (category == 'Tags' || category == 'Countries') {
        // 完整面板可搜索未出现在热门快捷项中的标签和国家。
        await tester.tap(find.text('View all'));
        await tester.pumpAndSettle();
        if (category == 'Countries') {
          // 字母索引可从完整国家列表直接定位 C 分组。
          await tester.tap(find.widgetWithText(ChoiceChip, 'C'));
          await tester.pumpAndSettle();
          expect(find.widgetWithText(ListTile, 'Country 1'), findsOneWidget);
        }
        await tester.enterText(find.byType(TextField).last, item);
        if (category == 'Tags') {
          // 标签搜索经过防抖后才向 API 查询。
          await tester.pump(const Duration(milliseconds: 350));
        }
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(ListTile, item));
      } else {
        await tester.tap(find.widgetWithText(AetherFilterChip, item));
      }
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
