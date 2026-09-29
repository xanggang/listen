import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/app_text.dart';

// 根据设计稿呈现注册欢迎页；首版只允许访客或登录入口直接进入应用。
class RegisterPage extends StatelessWidget {
  // 根据当前语言展示入口文案，并通过统一回调进入应用。
  const RegisterPage({super.key, required this.text, required this.onEnter});

  final AppText text;
  final VoidCallback onEnter;

  // 注册服务尚未接入时给出明确反馈，避免误以为账户已创建。
  void _showRegistrationUnavailable(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text.get('registrationUnavailable'))),
    );
  }

  // 顶部保留设计稿的播出状态胶囊，并提供直接进入应用的登录入口。
  Widget _topBar(AetherPalette palette) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: palette.surface.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: palette.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.circle, color: palette.live, size: 9),
              const SizedBox(width: 8),
              Text(
                text.get('entryStatus'),
                style: TextStyle(
                  color: palette.live,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
        ),
        const Spacer(),
        TextButton.icon(
          onPressed: onEnter,
          label: Text(text.get('goToLogin')),
          icon: const Icon(Icons.arrow_forward_rounded, size: 18),
          iconAlignment: IconAlignment.end,
        ),
      ],
    );
  }

  // 声波徽章与双行标题复用当前主题色，在小屏上保持居中可读。
  Widget _hero(BuildContext context, AetherPalette palette) {
    return Column(
      children: [
        Stack(
          alignment: Alignment.bottomCenter,
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 82,
              height: 82,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: palette.surfaceRaised.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: palette.primary.withValues(alpha: 0.4),
                ),
                boxShadow: [
                  BoxShadow(
                    color: palette.primary.withValues(alpha: 0.22),
                    blurRadius: 30,
                  ),
                ],
              ),
              child: const WorldTunerLogo(size: 62),
            ),
            Positioned(
              bottom: -17,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: palette.surfaceDeep,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: palette.border),
                ),
                child: Text(
                  'worldTuner',
                  style: TextStyle(
                    color: palette.text,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 42),
        Text(
          text.get('entryTitleFirst'),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: palette.text,
            fontFamily: 'PlusJakartaSans',
            fontSize: 27,
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(
          text.get('entryTitleSecond'),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: palette.primary,
            fontFamily: 'PlusJakartaSans',
            fontSize: 27,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 14),
        Text(
          text.get('entrySubtitle'),
          textAlign: TextAlign.center,
          style: TextStyle(color: palette.muted, fontSize: 14, height: 1.6),
        ),
        const SizedBox(height: 24),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: palette.surface.withValues(alpha: 0.82),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: palette.border),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 21,
                backgroundColor: palette.primarySoft,
                child: Icon(Icons.public_rounded, color: palette.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      text.get('entryFeatureTitle'),
                      style: TextStyle(
                        color: palette.text,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      text.get('entryFeatureSubtitle'),
                      style: TextStyle(color: palette.muted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Icon(Icons.graphic_eq_rounded, color: palette.live, size: 21),
            ],
          ),
        ),
      ],
    );
  }

  // 第三方按钮只作为临时登录入口，点击后走同一访客进入流程。
  Widget _loginOption(AetherPalette palette, String label, Widget icon) {
    return Expanded(
      child: OutlinedButton(
        onPressed: onEnter,
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.text,
          side: BorderSide(color: palette.border),
          padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 4),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            icon,
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 所有登录和访客按钮可进入应用；注册按钮明确提示当前不可用。
  Widget _actions(BuildContext context, AetherPalette palette) {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton.icon(
            // 注册接口尚未开放，点击时只说明当前状态。
            onPressed: () => _showRegistrationUnavailable(context),
            icon: const Icon(Icons.person_add_alt_1_rounded),
            label: Text(text.get('registerWithContact')),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            _loginOption(
              palette,
              'Apple',
              Icon(Icons.apple_rounded, size: 18, color: palette.text),
            ),
            const SizedBox(width: 8),
            _loginOption(
              palette,
              text.get('wechat'),
              Icon(Icons.chat_bubble_rounded, size: 17, color: palette.live),
            ),
            const SizedBox(width: 8),
            _loginOption(
              palette,
              'Google',
              Text(
                'G',
                style: TextStyle(
                  color: palette.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 13),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            TextButton(
              onPressed: onEnter,
              child: Text(text.get('passwordLogin')),
            ),
            Text('  |  ', style: TextStyle(color: palette.muted)),
            TextButton(
              // 新账户入口与主注册按钮共用明确的不可用提示。
              onPressed: () => _showRegistrationUnavailable(context),
              child: Text(text.get('registerNewAccount')),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton.icon(
            onPressed: onEnter,
            icon: const Icon(Icons.travel_explore_rounded),
            label: Text(text.get('exploreAsGuest')),
          ),
        ),
        const SizedBox(height: 20),
        Text(
          text.get('entryPrivacyNote'),
          textAlign: TextAlign.center,
          style: TextStyle(color: palette.muted, fontSize: 10),
        ),
      ],
    );
  }

  // 在手机高度不足时整体滚动，避免操作按钮被键盘或系统手势区遮挡。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return Scaffold(
      backgroundColor: palette.canvas,
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    palette.primary.withValues(
                      alpha: palette.isDark ? 0.1 : 0.05,
                    ),
                    palette.canvas,
                    palette.violet.withValues(
                      alpha: palette.isDark ? 0.08 : 0.04,
                    ),
                    palette.canvas,
                  ],
                ),
              ),
              child: CustomPaint(
                painter: _EntryBackdropPainter(palette.isDark),
              ),
            ),
          ),
          SafeArea(
            child: LayoutBuilder(
              // 保持顶部状态、中央品牌和底部操作三个层级可伸缩。
              builder: (context, constraints) => SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 14, 24, 20),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _topBar(palette),
                        const SizedBox(height: 40),
                        _hero(context, palette),
                        const SizedBox(height: 40),
                        _actions(context, palette),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// 在欢迎页背景绘制轻量网格和频率轨道，不承载交互信息。
class _EntryBackdropPainter extends CustomPainter {
  // 背景颜色随深浅主题切换。
  const _EntryBackdropPainter(this.isDark);

  final bool isDark;

  // 网格保持低对比度，圆弧复现设计稿的空间深度。
  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()
      ..color = (isDark ? Colors.white : Colors.black).withValues(alpha: 0.035)
      ..strokeWidth = 0.5;
    for (double x = 0; x < size.width; x += 32) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (double y = 0; y < size.height; y += 32) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    final orbit = Paint()
      ..color = const Color(0xFF00F2FE).withValues(alpha: 0.13)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawCircle(
      Offset(size.width * 0.12, size.height * 0.06),
      math.min(size.width * 0.58, 240),
      orbit,
    );
    orbit.color = const Color(0xFF8B5CF6).withValues(alpha: 0.13);
    canvas.drawCircle(
      Offset(size.width * 0.85, size.height * 0.27),
      math.min(size.width * 0.5, 210),
      orbit,
    );
  }

  // 轨道只受主题影响，亮度不变时无需重绘。
  @override
  bool shouldRepaint(covariant _EntryBackdropPainter oldDelegate) =>
      oldDelegate.isDark != isDark;
}
