import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:worldtuner_mobile/core/api_client.dart';
import 'package:worldtuner_mobile/core/app_text.dart';
import 'package:worldtuner_mobile/features/stations/catalog_picker.dart';

// 验证已缓存国家随界面语言更新，中文搜索和代码搜索不发起重复请求。
void main() {
  // 使用真实筛选组件确认译名、回退与英文索引行为。
  testWidgets(
    'country picker switches cached names and searches Chinese or code',
    (tester) async {
      var requests = 0;
      final api = ApiClient(
        origin: Uri.parse('https://api.example.com'),
        client: MockClient(
          // 一次返回所有名称，语言切换与本地筛选均复用此响应。
          (request) async {
            requests++;
            return http.Response(
              jsonEncode({
                'data': [
                  {
                    'id': '123',
                    'name': 'China',
                    'name_en': 'China',
                    'name_zh': '中国',
                    'code': 'CN',
                  },
                  {
                    'id': '124',
                    'name': 'Unknown',
                    'name_en': 'Unknown',
                    'code': 'XX',
                  },
                ],
              }),
              200,
              headers: {'content-type': 'application/json; charset=utf-8'},
            );
          },
        ),
      );
      addTearDown(api.dispose);
      // 保持相同组件位置，切换语言不销毁字典缓存。
      Widget page(String locale) => MaterialApp(
        home: Scaffold(
          body: CatalogPicker(
            api: api,
            text: AppText(locale),
            kind: 'countries',
            title: 'Countries',
            selectedId: null,
            // 测试不选择电台，只检查列表展示与搜索。
            onSelected: (item) {},
            // 本例不清除筛选。
            onClear: () {},
          ),
        ),
      );
      await tester.pumpWidget(page('zh'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(ListTile, '中国'), findsOneWidget);
      expect(find.widgetWithText(ListTile, 'Unknown'), findsOneWidget);
      expect(find.byType(ChoiceChip), findsNothing);
      for (final query in ['中国', 'CN']) {
        await tester.enterText(find.byType(TextField), query);
        await tester.pumpAndSettle();
        expect(find.widgetWithText(ListTile, '中国'), findsOneWidget);
        expect(find.widgetWithText(ListTile, 'Unknown'), findsNothing);
      }
      await tester.enterText(find.byType(TextField), '');
      await tester.pumpWidget(page('en'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(ListTile, 'China'), findsOneWidget);
      expect(find.widgetWithText(ChoiceChip, 'C'), findsOneWidget);
      final labels = tester
          .widgetList<ListTile>(find.byType(ListTile))
          .map(
            // 英文切换后重新排序，不沿用中文界面的缓存顺序。
            (tile) => (tile.title as Text).data,
          )
          .toList();
      expect(labels.indexOf('China'), lessThan(labels.indexOf('Unknown')));
      expect(requests, 1);
    },
  );
}
