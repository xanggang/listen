import 'package:flutter/material.dart';

import '../../core/app_text.dart';
import 'player_controller.dart';

// 始终显示在导航栏上方的迷你播放器。
class PlayerBar extends StatelessWidget {
  const PlayerBar({super.key, required this.player, required this.text});

  final PlayerController player;
  final AppText text;

  // 展示当前音频引擎状态，并提供播放、暂停与详情入口。
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: player,
      builder: (context, child) {
        final station = player.current;
        if (station == null) return const SizedBox.shrink();
        final t = text.get;
        return Material(
          color: Theme.of(context).colorScheme.surfaceContainer,
          child: SafeArea(
            top: false,
            bottom: false,
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.radio)),
              title: Text(
                station.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                player.errorMessage != null
                    ? t('audioError')
                    : player.buffering
                    ? t('buffering')
                    : player.playing
                    ? t('playing')
                    : t('paused'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => showModalBottomSheet<void>(
                context: context,
                showDragHandle: true,
                builder: (context) =>
                    _PlayerDetails(player: player, text: text),
              ),
              trailing: player.buffering
                  ? const SizedBox(
                      width: 36,
                      height: 36,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : IconButton(
                      icon: Icon(
                        player.playing ? Icons.pause_circle : Icons.play_circle,
                        size: 34,
                      ),
                      onPressed: player.toggle,
                    ),
            ),
          ),
        );
      },
    );
  }
}

// 显示当前电台的完整播放控制和元数据。
class _PlayerDetails extends StatelessWidget {
  const _PlayerDetails({required this.player, required this.text});

  final PlayerController player;
  final AppText text;

  // 根据播放器通知实时刷新底部详情面板。
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: player,
      builder: (context, child) {
        final station = player.current;
        if (station == null) return const SizedBox.shrink();
        final t = text.get;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.radio, size: 72),
                const SizedBox(height: 16),
                Text(
                  station.name,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  [station.country, station.language, station.codec]
                      .whereType<String>()
                      .where((value) => value.isNotEmpty)
                      .join(' • '),
                ),
                if (player.errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      t('audioError'),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                const SizedBox(height: 18),
                IconButton.filled(
                  iconSize: 36,
                  onPressed: player.buffering ? null : player.toggle,
                  icon: Icon(player.playing ? Icons.pause : Icons.play_arrow),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
