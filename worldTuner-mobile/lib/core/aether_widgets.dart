import 'package:flutter/material.dart';

import '../features/stations/station.dart';
import 'aether_theme.dart';
import 'app_text.dart';

// 四个页面共用的品牌栏，保留设计稿的声波标识和紧凑高度。
class AetherHeader extends StatelessWidget {
  const AetherHeader({super.key, this.trailing});

  final Widget? trailing;

  // 在系统安全区域内绘制品牌栏。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: palette.canvas,
        border: Border(bottom: BorderSide(color: palette.border)),
      ),
      child: Row(
        children: [
          Icon(Icons.graphic_eq_rounded, color: palette.primary, size: 28),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              'Aether Radio',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

// 标题、英文辅助文字与可选操作遵循设计稿的章节层级。
class AetherSectionHeading extends StatelessWidget {
  const AetherSectionHeading({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  // 绘制可复用的章节标题行。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return Row(
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        if (subtitle != null) ...[
          const SizedBox(width: 8),
          Text(subtitle!, style: TextStyle(color: palette.muted, fontSize: 12)),
        ],
        const Spacer(),
        ?trailing,
      ],
    );
  }
}

// 共用圆角筛选标签，按主题显示当前筛选状态。
class AetherFilterChip extends StatelessWidget {
  const AetherFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  // 为筛选项保留可点击面积并提供明确的选中态。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return Material(
      color: selected ? palette.primary : palette.surface,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? palette.primary : palette.border,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? palette.onPrimary : palette.text,
              fontSize: 12,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

// 电台封面优先使用 API favicon，坏链接时回退到主题收音机图标。
class StationArtwork extends StatelessWidget {
  const StationArtwork({super.key, required this.station, this.size = 48});

  final Station station;
  final double size;

  // 绘制独立于列表和播放器的方形电台封面。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    final uri = Uri.tryParse(station.favicon ?? '');
    final valid =
        uri != null &&
        uri.hasAuthority &&
        (uri.scheme == 'http' || uri.scheme == 'https');
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.28),
      child: SizedBox(
        width: size,
        height: size,
        child: valid
            ? Image.network(
                uri.toString(),
                fit: BoxFit.cover,
                // 第三方 favicon 失效时保留可辨认的电台占位图。
                errorBuilder: (context, error, stackTrace) =>
                    _fallback(palette),
              )
            : _fallback(palette),
      ),
    );
  }

  // 使用当前主题色绘制无图电台的统一占位图。
  Widget _fallback(AetherPalette palette) {
    return ColoredBox(
      color: palette.primarySoft,
      child: Icon(
        Icons.radio_rounded,
        color: palette.primary,
        size: size * 0.5,
      ),
    );
  }
}

// 统一的双语标题，避免各页面直接拼接英文和中文。
String localizedName(AppText text, String chinese, String english) =>
    text.language == 'zh' ? chinese : english;
