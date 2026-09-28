import 'package:flutter/material.dart';

import '../../core/aether_theme.dart';
import '../../core/aether_widgets.dart';
import '../../core/app_text.dart';
import '../stations/station_library.dart';
import 'player_controller.dart';

// 设计稿中的悬浮迷你播放器，始终跟随唯一音频引擎的状态。
class PlayerBar extends StatelessWidget {
  const PlayerBar({
    super.key,
    required this.player,
    required this.library,
    required this.text,
  });

  final PlayerController player;
  final StationLibrary library;
  final AppText text;

  // 打开当前电台的详情与播放控制面板。
  void _openDetails(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      // 底部面板与迷你播放器共用播放与收藏状态。
      builder: (context) =>
          _PlayerDetails(player: player, library: library, text: text),
    );
  }

  // 根据当前电台展示封面、播放状态、收藏和暂停按钮。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return ListenableBuilder(
      listenable: Listenable.merge([player, library]),
      // 播放与收藏任一状态变化都刷新迷你播放器。
      builder: (context, child) {
        final station = player.current;
        if (station == null) return const SizedBox.shrink();
        return Container(
          margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
          decoration: BoxDecoration(
            color: palette.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: palette.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(
                  alpha: palette.isDark ? 0.35 : 0.08,
                ),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              StationArtwork(station: station, size: 50),
              const SizedBox(width: 10),
              Expanded(
                child: InkWell(
                  onTap: () => _openDetails(context),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        station.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        player.errorMessage != null
                            ? text.get('audioError')
                            : player.buffering
                            ? text.get('buffering')
                            : station.country ?? text.get('live'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: palette.muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
              IconButton(
                tooltip: text.get('favorites'),
                onPressed: () => library.toggleFavorite(station),
                icon: Icon(
                  library.isFavorite(station.id)
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                  color: library.isFavorite(station.id)
                      ? const Color(0xFFF43F5E)
                      : palette.muted,
                ),
              ),
              SizedBox(
                width: 44,
                height: 44,
                child: IconButton.filled(
                  tooltip: player.playing
                      ? text.get('pause')
                      : text.get('play'),
                  onPressed: player.buffering ? null : player.toggle,
                  icon: player.buffering
                      ? const SizedBox(
                          width: 19,
                          height: 19,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          player.playing
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                        ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// 半屏播放详情保留电台真实元数据，不显示 API 未提供的曲目或听众数。
class _PlayerDetails extends StatelessWidget {
  const _PlayerDetails({
    required this.player,
    required this.library,
    required this.text,
  });

  final PlayerController player;
  final StationLibrary library;
  final AppText text;

  // 绘制随播放器状态更新的电台信息和操作按钮。
  @override
  Widget build(BuildContext context) {
    final palette = AetherPalette.of(context);
    return ListenableBuilder(
      listenable: Listenable.merge([player, library]),
      // 系统媒体控制变化时同步刷新半屏面板。
      builder: (context, child) {
        final station = player.current;
        if (station == null) return const SizedBox.shrink();
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 10, 24, 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                StationArtwork(station: station, size: 96),
                const SizedBox(height: 18),
                Text(
                  station.name,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  [station.country, station.language, station.codec]
                      .whereType<String>()
                      .where((value) => value.isNotEmpty)
                      .join(' · '),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: palette.muted),
                ),
                if (player.errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    text.get('audioError'),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 22),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      tooltip: text.get('favorites'),
                      onPressed: () => library.toggleFavorite(station),
                      icon: Icon(
                        library.isFavorite(station.id)
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                        color: library.isFavorite(station.id)
                            ? const Color(0xFFF43F5E)
                            : palette.muted,
                      ),
                    ),
                    const SizedBox(width: 24),
                    IconButton.filled(
                      iconSize: 32,
                      onPressed: player.buffering ? null : player.toggle,
                      icon: Icon(
                        player.playing
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
