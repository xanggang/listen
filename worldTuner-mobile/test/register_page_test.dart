import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worldtuner_mobile/core/aether_theme.dart';
import 'package:worldtuner_mobile/core/app_text.dart';
import 'package:worldtuner_mobile/features/onboarding/register_page.dart';

// 验证欢迎页在手机尺寸下可操作，登录与注册入口保持不同语义。
void main() {
  testWidgets('login enters app while registration reports unavailable', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    // 用例结束后恢复测试视口，避免影响其他页面的尺寸断言。
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var entered = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAetherTheme(Brightness.dark),
        home: RegisterPage(
          text: const AppText('zh'),
          // 登录入口只通知应用切换页面，不执行鉴权。
          onEnter: () => entered = true,
        ),
      ),
    );

    await tester.tap(find.text('使用手机号 / 邮箱注册'));
    await tester.pump();
    expect(find.textContaining('注册功能尚未开放'), findsOneWidget);
    expect(entered, isFalse);

    await tester.tap(find.text('去登录'));
    expect(entered, isTrue);
    expect(tester.takeException(), isNull);
  });
}
