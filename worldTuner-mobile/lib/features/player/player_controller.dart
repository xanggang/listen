import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../stations/station.dart';
import '../stations/station_library.dart';

// 跨页面唯一音频播放器；播放状态以音频引擎事件为准。
class PlayerController extends ChangeNotifier {
  // 初始化播放状态和错误事件订阅，播放器生命周期由主容器持有。
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
        _logPlaybackError('state', error);
        errorMessage = error.toString();
        playing = false;
        buffering = false;
        notifyListeners();
      },
    );
    _errorSubscription = _player.errorStream.listen(
      // 音频源加载后发生的断流和解码错误由 just_audio 单独上报。
      (error) {
        _logPlaybackError('stream', error);
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
  StreamSubscription<PlayerException>? _errorSubscription;
  Station? current;
  bool playing = false;
  bool buffering = false;
  String? errorMessage;
  int _requestVersion = 0;

  // 仅在 Debug 模式输出播放诊断，移除错误文本中的完整 URL 以免暴露流参数。
  void _logPlaybackError(String stage, Object error) {
    if (!kDebugMode) return;
    final code = error is PlayerException ? ' code=${error.code}' : '';
    final sanitized = error.toString().replaceAll(
      RegExp(r'https?://[^\s)]+'),
      '<stream-url>',
    );
    final message = sanitized.length > 400
        ? '${sanitized.substring(0, 400)}…'
        : sanitized;
    final scheme = Uri.tryParse(current?.streamUrl ?? '')?.scheme ?? '';
    debugPrint(
      '[worldTuner/audio] stage=$stage stationId=${current?.id} '
      'scheme=$scheme type=${error.runtimeType}$code message=$message',
    );
  }

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
      _logPlaybackError(
        'validate',
        const FormatException('Invalid stream URL'),
      );
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
            id: station.id,
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
            _logPlaybackError('play', error);
            errorMessage = error.toString();
            notifyListeners();
          }
        }),
      );
    } catch (error) {
      if (version != _requestVersion) return;
      _logPlaybackError('load', error);
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
      _logPlaybackError('toggle', error);
      errorMessage = error.toString();
      notifyListeners();
    }
  }

  // 清理音频事件订阅与原生播放器资源。
  @override
  void dispose() {
    _subscription?.cancel();
    _errorSubscription?.cancel();
    _player.dispose();
    super.dispose();
  }
}
