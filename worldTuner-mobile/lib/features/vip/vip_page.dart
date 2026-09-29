import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/app_text.dart';

// 展示尚未上线的 VIP 权益规划；页面不提供购买或开通入口。
class VipPage extends StatefulWidget {
  // 由主容器传入返回动作，确保播放器和个人中心状态不被销毁。
  const VipPage({super.key, required this.text, required this.onBack});

  final AppText text;
  final VoidCallback onBack;

  // 创建权益锚点所需的页面状态。
  @override
  State<VipPage> createState() => _VipPageState();
}

// 仅管理“了解会员权益”按钮的滚动锚点。
class _VipPageState extends State<VipPage> {
  final GlobalKey _benefitsKey = GlobalKey();

  // 将权益标题滚动到可见区域，不改变当前播放状态。
  Future<void> _scrollToBenefits() async {
    final target = _benefitsKey.currentContext;
    if (target == null) return;
    await Scrollable.ensureVisible(
      target,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
      alignment: 0.08,
    );
  }

  // 页面顶部提供返回入口和简短的 VIP 品牌标识。
  Widget _header(AetherPalette palette) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: palette.surface,
        border: Border(bottom: BorderSide(color: palette.border)),
      ),
      child: Row(
        children: [
          IconButton.filledTonal(
            onPressed: widget.onBack,
            tooltip: widget.text.get('back'),
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          const Spacer(),
          const WorldTunerLogo(size: 24),
          const SizedBox(width: 7),
          Flexible(
            child: Text(
              'worldTuner',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: palette.text,
                fontFamily: 'PlusJakartaSans',
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 7),
          _tag('VIP', palette.violet),
        ],
      ),
    );
  }

  // 统一绘制轻量标签，避免将规划状态混同于可用功能。
  Widget _tag(String label, Color accent) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: accent,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
        ),
      ),
    );
  }

  // 复现设计稿的地球经纬线、城市信号点与中心品牌标识。
  Widget _globe(AetherPalette palette) {
    return SizedBox(
      width: 190,
      height: 180,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: CustomPaint(painter: _VipGlobePainter(palette.isDark)),
          ),
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: palette.primary.withValues(alpha: 0.1),
              border: Border.all(color: palette.primary.withValues(alpha: 0.4)),
            ),
            child: const WorldTunerLogo(size: 42),
          ),
          Positioned(
            top: 36,
            left: 18,
            child: _citySignal('PARIS', palette.primary),
          ),
          Positioned(
            top: 62,
            right: 6,
            child: _citySignal('LONDON', palette.violet),
          ),
          Positioned(
            bottom: 37,
            right: 17,
            child: _citySignal('TOKYO', palette.live),
          ),
        ],
      ),
    );
  }

  // 单个城市信号仅用于地球概念插画，不表示实时电台数据。
  Widget _citySignal(String city, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          city,
          style: TextStyle(
            color: color,
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
      ],
    );
  }

  // 将三个计划权益放在可换行标签中，适配中英文窄屏。
  Widget _featureTags(AetherPalette palette) {
    final items = <(IconData, String, Color)>[
      (Icons.sync_rounded, widget.text.get('vipSync'), palette.primary),
      (
        Icons.folder_special_rounded,
        widget.text.get('vipGroups'),
        palette.violet,
      ),
      (Icons.alarm_rounded, widget.text.get('vipSchedule'), palette.live),
    ];
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 7,
      runSpacing: 7,
      children: [
        for (final item in items)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: palette.surfaceRaised,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: palette.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(item.$1, size: 15, color: item.$3),
                const SizedBox(width: 5),
                Text(
                  item.$2,
                  style: TextStyle(
                    color: palette.text,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  // 示例电台卡始终标记为概念内容，不连接真实播放或预约接口。
  Widget _sampleStation(AetherPalette palette) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _tag(widget.text.get('vipSample'), palette.muted),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  widget.text.get('vipSampleStatus'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: TextStyle(color: palette.muted, fontSize: 11),
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: palette.surfaceRaised,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.radio_rounded, color: palette.primary),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.text.get('vipSampleStation'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: palette.text,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      widget.text.get('vipSampleDescription'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: palette.muted, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // 首屏集中说明价值与上线状态，并提供权益锚点和返回动作。
  Widget _hero(AetherPalette palette) {
    return Column(
      children: [
        _globe(palette),
        const SizedBox(height: 7),
        _tag(widget.text.get('vipEyebrow'), palette.violet),
        const SizedBox(height: 14),
        Text(
          widget.text.get('vipHeroFirst'),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: palette.text,
            fontFamily: 'PlusJakartaSans',
            fontSize: 27,
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(
          widget.text.get('vipHeroSecond'),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: palette.primary,
            fontFamily: 'PlusJakartaSans',
            fontSize: 27,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          widget.text.get('vipHeroDescription'),
          textAlign: TextAlign.center,
          style: TextStyle(color: palette.muted, fontSize: 14, height: 1.5),
        ),
        const SizedBox(height: 18),
        _featureTags(palette),
        const SizedBox(height: 22),
        _sampleStation(palette),
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton.icon(
            // 点击仅滚动到权益内容，不触发购买或账户动作。
            onPressed: () => unawaited(_scrollToBenefits()),
            icon: const Icon(Icons.arrow_downward_rounded, size: 18),
            label: Text(widget.text.get('vipBenefitsAction')),
          ),
        ),
        TextButton(
          onPressed: widget.onBack,
          child: Text(widget.text.get('vipFreeAction')),
        ),
        Text(
          widget.text.get('vipConceptNote'),
          textAlign: TextAlign.center,
          style: TextStyle(color: palette.muted, fontSize: 11, height: 1.4),
        ),
      ],
    );
  }

  // 权益卡用固定的规划标签和示意内容说明未来目标体验。
  Widget _benefitCard(
    AetherPalette palette, {
    required String labelKey,
    required String titleKey,
    required String descriptionKey,
    required String previewKey,
    required IconData icon,
    required Color accent,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.text.get(labelKey),
                  style: TextStyle(
                    color: accent,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _tag(widget.text.get('vipSampleStatus'), palette.muted),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            widget.text.get(titleKey),
            style: TextStyle(
              color: palette.text,
              fontFamily: 'PlusJakartaSans',
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            widget.text.get(descriptionKey),
            style: TextStyle(color: palette.muted, fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: palette.surfaceDeep,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: palette.border),
            ),
            child: Row(
              children: [
                Icon(icon, color: accent, size: 20),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    widget.text.get(previewKey),
                    style: TextStyle(color: palette.text, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // 三项权益依照设计稿顺序展示，标题作为首屏按钮的滚动目标。
  Widget _benefits(AetherPalette palette) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          key: _benefitsKey,
          children: [
            Expanded(
              child: _sectionTitle(
                widget.text.get('vipBenefitsTitle'),
                palette,
              ),
            ),
            _tag(widget.text.get('vipPlanned'), palette.violet),
          ],
        ),
        const SizedBox(height: 14),
        _benefitCard(
          palette,
          labelKey: 'vipBenefitOneLabel',
          titleKey: 'vipBenefitOneTitle',
          descriptionKey: 'vipBenefitOneDescription',
          previewKey: 'vipBenefitOnePreview',
          icon: Icons.cloud_sync_rounded,
          accent: palette.primary,
        ),
        const SizedBox(height: 12),
        _benefitCard(
          palette,
          labelKey: 'vipBenefitTwoLabel',
          titleKey: 'vipBenefitTwoTitle',
          descriptionKey: 'vipBenefitTwoDescription',
          previewKey: 'vipBenefitTwoPreview',
          icon: Icons.folder_special_rounded,
          accent: palette.violet,
        ),
        const SizedBox(height: 12),
        _benefitCard(
          palette,
          labelKey: 'vipBenefitThreeLabel',
          titleKey: 'vipBenefitThreeTitle',
          descriptionKey: 'vipBenefitThreeDescription',
          previewKey: 'vipBenefitThreePreview',
          icon: Icons.alarm_rounded,
          accent: palette.live,
        ),
      ],
    );
  }

  // 章节标题沿用应用现有字体层级。
  Widget _sectionTitle(String title, AetherPalette palette) {
    return Text(
      title,
      style: TextStyle(
        color: palette.text,
        fontFamily: 'PlusJakartaSans',
        fontSize: 21,
        fontWeight: FontWeight.w800,
      ),
    );
  }

  // 对比栏分别标出当前免费能力与未来的 VIP 规划。
  Widget _comparisonCard(
    AetherPalette palette, {
    required String titleKey,
    required String statusKey,
    required List<String> featureKeys,
    required Color accent,
    required IconData icon,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.text.get(titleKey),
                  style: TextStyle(
                    color: palette.text,
                    fontWeight: FontWeight.w700,
                    fontSize: 17,
                  ),
                ),
              ),
              _tag(widget.text.get(statusKey), accent),
            ],
          ),
          const SizedBox(height: 11),
          for (final key in featureKeys)
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(
                children: [
                  Icon(icon, color: accent, size: 17),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      widget.text.get(key),
                      style: TextStyle(color: palette.text, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  // 免费与 VIP 关系说明避免将已有地图、搜索和播放误标为会员专属。
  Widget _comparison(AetherPalette palette) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(widget.text.get('vipCompareTitle'), palette),
        const SizedBox(height: 7),
        Text(
          widget.text.get('vipCompareDescription'),
          style: TextStyle(color: palette.muted, fontSize: 13, height: 1.5),
        ),
        const SizedBox(height: 14),
        _comparisonCard(
          palette,
          titleKey: 'vipFreeTitle',
          statusKey: 'vipFreeStatus',
          featureKeys: const [
            'vipFreeFeatureOne',
            'vipFreeFeatureTwo',
            'vipFreeFeatureThree',
            'vipFreeFeatureFour',
          ],
          accent: palette.live,
          icon: Icons.check_circle_rounded,
        ),
        const SizedBox(height: 10),
        _comparisonCard(
          palette,
          titleKey: 'vipPremiumTitle',
          statusKey: 'vipPremiumStatus',
          featureKeys: const [
            'vipPremiumFeatureOne',
            'vipPremiumFeatureTwo',
            'vipPremiumFeatureThree',
          ],
          accent: palette.violet,
          icon: Icons.add_circle_outline_rounded,
        ),
        const SizedBox(height: 10),
        Text(
          widget.text.get('vipFreeFooter'),
          style: TextStyle(color: palette.live, fontSize: 12),
        ),
      ],
    );
  }

  // 方案卡仅展示未来周期和待公布状态，不含价格或购买交互。
  Widget _planCard(AetherPalette palette, String titleKey, IconData icon) {
    return Expanded(
      child: Container(
        constraints: const BoxConstraints(minHeight: 118),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: palette.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: palette.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: palette.violet, size: 21),
            const SizedBox(height: 12),
            Text(
              widget.text.get(titleKey),
              style: TextStyle(
                color: palette.text,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              widget.text.get('vipPricePending'),
              style: TextStyle(color: palette.muted, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  // 月度和年度规划并列呈现，英文长文案可在卡内换行。
  Widget _plans(AetherPalette palette) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(widget.text.get('vipPlansTitle'), palette),
        const SizedBox(height: 7),
        Text(
          widget.text.get('vipPlansDescription'),
          style: TextStyle(color: palette.muted, fontSize: 13, height: 1.5),
        ),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _planCard(palette, 'vipMonthly', Icons.calendar_view_month_rounded),
            const SizedBox(width: 10),
            _planCard(palette, 'vipYearly', Icons.calendar_month_rounded),
          ],
        ),
      ],
    );
  }

  // 常见问题固定展开，确保功能边界无需额外点击即可阅读。
  Widget _faqItem(
    AetherPalette palette,
    int number,
    String questionKey,
    String answerKey,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Q$number',
            style: TextStyle(
              color: palette.primary,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            widget.text.get(questionKey),
            style: TextStyle(color: palette.text, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 5),
          Text(
            widget.text.get(answerKey),
            style: TextStyle(color: palette.muted, fontSize: 13, height: 1.5),
          ),
        ],
      ),
    );
  }

  // FAQ 与底部返回按钮收束页面，不显示订阅承诺。
  Widget _footer(AetherPalette palette) {
    return Column(
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: _sectionTitle(widget.text.get('vipFaqTitle'), palette),
        ),
        const SizedBox(height: 13),
        for (final item in const [
          (1, 'vipFaqOneQuestion', 'vipFaqOneAnswer'),
          (2, 'vipFaqTwoQuestion', 'vipFaqTwoAnswer'),
          (3, 'vipFaqThreeQuestion', 'vipFaqThreeAnswer'),
        ]) ...[
          _faqItem(palette, item.$1, item.$2, item.$3),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: 14),
        Text(
          widget.text.get('vipClosing'),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: palette.text,
            fontFamily: 'PlusJakartaSans',
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: FilledButton.icon(
            onPressed: widget.onBack,
            icon: const Icon(Icons.travel_explore_rounded),
            label: Text(widget.text.get('vipExploreAction')),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          widget.text.get('vipComingSoon'),
          style: TextStyle(color: palette.muted, fontSize: 11),
        ),
      ],
    );
  }

  // 纵向滚动内容随主题配色变化，底部留白由主容器播放器负责。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return ColoredBox(
      color: palette.canvas,
      child: Column(
        children: [
          _header(palette),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: Column(
                    children: [
                      _hero(palette),
                      const SizedBox(height: 38),
                      _benefits(palette),
                      const SizedBox(height: 38),
                      _comparison(palette),
                      const SizedBox(height: 38),
                      _plans(palette),
                      const SizedBox(height: 38),
                      _footer(palette),
                    ],
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

// 概念地球使用轻量原生绘制，不依赖地图网络资源。
class _VipGlobePainter extends CustomPainter {
  // 只接收主题亮度，以便背景网格在日间和夜间保持低对比度。
  const _VipGlobePainter(this.isDark);

  final bool isDark;

  // 绘制外圈、经线和纬线，节点文字由上层组件保持清晰。
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) * 0.45;
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.black).withValues(alpha: 0.17)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawCircle(center, radius, paint);
    canvas.drawCircle(center, radius * 0.79, paint);
    canvas.drawOval(
      Rect.fromCenter(center: center, width: radius * 0.8, height: radius * 2),
      paint,
    );
    canvas.drawOval(
      Rect.fromCenter(center: center, width: radius * 2, height: radius * 0.7),
      paint,
    );
    canvas.drawLine(
      Offset(center.dx - radius, center.dy),
      Offset(center.dx + radius, center.dy),
      paint,
    );
  }

  // 主题不变时不重绘静态经纬线。
  @override
  bool shouldRepaint(covariant _VipGlobePainter oldDelegate) =>
      oldDelegate.isDark != isDark;
}
