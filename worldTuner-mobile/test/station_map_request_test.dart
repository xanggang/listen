import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:worldtuner_mobile/core/app_text.dart';
import 'package:worldtuner_mobile/features/map/station_map_request.dart';
import 'package:worldtuner_mobile/features/stations/station.dart';
import 'package:worldtuner_mobile/features/stations/station_library.dart';
import 'package:worldtuner_mobile/features/stations/station_results.dart';

// 验证真实列表行的地图操作独立于收藏、播放，并支持重复定位和语言切换。
void main() {
  // 使用内存偏好存储，测试不访问设备插件或真实收藏记录。
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });
  // 触发按钮通知即可验证导航契约，无需启动原生 WebView 或音频服务。
  testWidgets('locate emits fresh requests without playing or saving', (
    tester,
  ) async {
    final library = StationLibrary(SharedPreferencesAsync());
    addTearDown(library.dispose);
    const station = Station(
      id: '0aB12xY',
      name: 'Radio',
      url: 'https://example.com/stream',
    );
    final requests = <StationMapRequest>[];
    var plays = 0;
    // 用同一个列表组件切换文案，确认地图入口不会丢失。
    Widget page(String locale) => MaterialApp(
      home: Scaffold(
        body: NotificationListener<StationMapRequest>(
          // 代替主导航捕获每次请求，重复点击不应被合并。
          onNotification: (request) {
            requests.add(request);
            return true;
          },
          child: StationTile(
            station: station,
            library: library,
            text: AppText(locale),
            // 定位按钮不能调用此播放回调。
            onPlay: () => plays++,
          ),
        ),
      ),
    );
    await tester.pumpWidget(page('zh'));
    await tester.tap(find.byTooltip('在地图上定位'));
    await tester.pump();
    await tester.tap(find.byTooltip('在地图上定位'));
    expect(requests.length, 2);
    expect(requests.first.station, same(station));
    expect(requests.first, isNot(same(requests.last)));
    expect(plays, 0);
    expect(library.favorites, isEmpty);
    expect(library.recent, isEmpty);
    await tester.pumpWidget(page('en'));
    expect(find.byTooltip('Show on map'), findsOneWidget);
  });
}
