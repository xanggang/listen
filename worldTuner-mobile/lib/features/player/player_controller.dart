import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../stations/station.dart';
import '../stations/station_library.dart';

// 跨页面唯一音频播放器；播放状态以音频引擎事件为准。
class PlayerController extends ChangeNotifier {
  PlayerController(this.library) {
    _subscription = _player.playerStateStream.listen(
      // 系统通知、耳机按钮等外部操作也会刷新界面。
      (state) {
        playing = state.playing;
        buffering =
            state.processingState == ProcessingState.loading ||
            state.processingState == ProcessingState.buffering;
        notifyListeners();
      },
      // 流媒体运行时错误不能只靠首次 setAudioSource 的异常捕获。
      onError: (Object error, StackTrace stack) {
        errorMessage = error.toString();
        playing = false;
        buffering = false;
        notifyListeners();
      },
    );
  }

  final AudioPlayer _player = AudioPlayer();
  final StationLibrary library;
  StreamSubscription<PlayerState>? _subscription;
  Station? current;
  bool playing = false;
  bool buffering = false;
  String? errorMessage;
  int _requestVersion = 0;

  // 选台并设置系统媒体信息；新请求会使旧的异步结果失效。
  Future<void> playStation(Station station) async {
    final version = ++_requestVersion;
    current = station;
    await library.recordPlayed(station);
    errorMessage = null;
    buffering = true;
    notifyListeners();
    final url = Uri.tryParse(station.streamUrl);
    if (url == null ||
        !url.hasAuthority ||
        (url.scheme != 'http' && url.scheme != 'https')) {
      errorMessage = 'Invalid stream URL';
      buffering = false;
      notifyListeners();
      return;
    }
    try {
      await _player.setAudioSource(
        AudioSource.uri(
          url,
          tag: MediaItem(
            id: '${station.id}',
            title: station.name,
            artist: [
              station.country,
              station.language,
            ].whereType<String>().where((x) => x.isNotEmpty).join(' • '),
            artUri: Uri.tryParse(station.favicon ?? ''),
          ),
        ),
      );
      if (version != _requestVersion) return;
      unawaited(
        _player.play().catchError((Object error) {
          if (version == _requestVersion) {
            errorMessage = error.toString();
            notifyListeners();
          }
        }),
      );
    } catch (error) {
      if (version != _requestVersion) return;
      errorMessage = error.toString();
      buffering = false;
      playing = false;
      notifyListeners();
    }
  }

  // 暂停或继续当前电台，错误由播放器状态暴露给界面。
  Future<void> toggle() async {
    if (current == null) return;
    try {
      if (_player.playing) {
        await _player.pause();
      } else {
        await _player.play();
      }
    } catch (error) {
      errorMessage = error.toString();
      notifyListeners();
    }
  }

  // 清理音频事件订阅与原生播放器资源。
  @override
  void dispose() {
    _subscription?.cancel();
    _player.dispose();
    super.dispose();
  }
}
