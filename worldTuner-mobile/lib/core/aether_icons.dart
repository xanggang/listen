import 'package:flutter/material.dart';

// 对应设计稿四个主导航图标的矢量轮廓。
enum AetherNavSymbol { globe, discover, charts, profile }

// 以可随主题着色的路径绘制导航图标，避免把图标表中的背景一起裁入界面。
class AetherNavIcon extends StatelessWidget {
  // 图标尺寸固定为 24dp，颜色由导航选中态提供。
  const AetherNavIcon({super.key, required this.symbol, required this.color});

  final AetherNavSymbol symbol;
  final Color color;

  // 根据设计稿的 36×36 坐标生成可缩放的图标画布。
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 24,
    height: 24,
    child: CustomPaint(painter: _AetherNavPainter(symbol, color)),
  );
}

// 将用户提供的 SVG 图标轮廓转为主题可复用的 Flutter Canvas 路径。
class _AetherNavPainter extends CustomPainter {
  // 保存图标类别与绘制颜色，供选中和未选中状态复用。
  const _AetherNavPainter(this.symbol, this.color);

  final AetherNavSymbol symbol;
  final Color color;

  // 绘制单个图标，不处理触摸区域或导航行为。
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 36, size.height / 36);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    switch (symbol) {
      case AetherNavSymbol.globe:
        canvas.drawCircle(const Offset(18, 18), 16, stroke);
        canvas.drawOval(const Rect.fromLTWH(10.5, 2, 15, 32), stroke);
        canvas.drawLine(const Offset(2, 18), const Offset(34, 18), stroke);
        canvas.drawLine(const Offset(4.5, 10), const Offset(31.5, 10), stroke);
        canvas.drawLine(const Offset(4.5, 26), const Offset(31.5, 26), stroke);
      case AetherNavSymbol.discover:
        canvas.drawCircle(const Offset(18, 18), 16, stroke);
        final compass = Path()
          ..moveTo(18, 8)
          ..lineTo(23, 15)
          ..lineTo(30, 18)
          ..lineTo(23, 21)
          ..lineTo(18, 28)
          ..lineTo(13, 21)
          ..lineTo(6, 18)
          ..lineTo(13, 15)
          ..close();
        canvas.drawPath(compass, stroke);
        canvas.drawCircle(const Offset(18, 18), 2.5, Paint()..color = color);
      case AetherNavSymbol.charts:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 16, 6, 15),
            const Radius.circular(1.5),
          ),
          stroke,
        );
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(15, 6, 6, 25),
            const Radius.circular(1.5),
          ),
          stroke,
        );
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(27, 11, 6, 20),
            const Radius.circular(1.5),
          ),
          stroke,
        );
        canvas.drawLine(const Offset(2, 32), const Offset(34, 32), stroke);
      case AetherNavSymbol.profile:
        canvas.drawCircle(const Offset(18, 12), 7, stroke);
        final shoulders = Path()
          ..moveTo(5, 30)
          ..cubicTo(5, 23.37, 10.82, 19, 18, 19)
          ..cubicTo(25.18, 19, 31, 23.37, 31, 30);
        canvas.drawPath(shoulders, stroke);
    }
    canvas.restore();
  }

  // 主题颜色或导航图标改变时才重新绘制。
  @override
  bool shouldRepaint(covariant _AetherNavPainter oldDelegate) =>
      oldDelegate.symbol != symbol || oldDelegate.color != color;
}
