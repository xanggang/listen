import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worldtuner_mobile/core/aether_theme.dart';
import 'package:worldtuner_mobile/core/app_text.dart';
import 'package:worldtuner_mobile/features/vip/vip_page.dart';

// 验证 VIP 概念页在手机尺寸下可浏览，并明确保留免费能力。
void main() {
  testWidgets('benefits action scrolls to planned benefits and back works', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    // 恢复测试视口，避免影响其他页面的尺寸断言。
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    var didReturn = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAetherTheme(Brightness.dark),
        home: Scaffold(
          body: VipPage(
            text: const AppText('zh'),
            // 测试返回动作由主容器接管。
            onBack: () => didReturn = true,
          ),
        ),
      ),
    );

    expect(find.text('worldTuner VIP · 即将推出'), findsOneWidget);
    await tester.tap(find.text('了解会员权益'));
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(find.text('核心权益规划')).dy, lessThan(250));
    expect(find.textContaining('地图、搜索与基础收听始终免费'), findsOneWidget);

    await tester.tap(find.byTooltip('返回'));
    expect(didReturn, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('English copy fits a narrow light-mode viewport', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    // 小屏用例结束后恢复默认测试视口。
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAetherTheme(Brightness.light),
        home: Scaffold(
          body: VipPage(
            text: const AppText('en'),
            // 本用例只检查布局，不执行返回操作。
            onBack: () {},
          ),
        ),
      ),
    );

    expect(find.text('worldTuner VIP · Coming soon'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
