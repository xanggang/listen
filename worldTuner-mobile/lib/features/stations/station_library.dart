import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'station.dart';

// 无账户版本的本地收藏与最近播放记录，避免设计稿展示虚构云端数据。
class StationLibrary extends ChangeNotifier {
  // 使用平台偏好作为无账户版本的本地存储。
  StationLibrary(this._preferences);

  final SharedPreferencesAsync _preferences;
  final List<Station> _favorites = [];
  final List<Station> _recent = [];

  List<Station> get favorites => List.unmodifiable(_favorites);
  List<Station> get recent => List.unmodifiable(_recent);

  // 从本地偏好中恢复收藏和最近播放，坏数据独立丢弃。
  Future<void> load() async {
    _favorites
      ..clear()
      ..addAll(_decode(await _preferences.getString('favorite_stations')));
    _recent
      ..clear()
      ..addAll(_decode(await _preferences.getString('recent_stations')));
    notifyListeners();
  }

  // 查询电台是否被当前设备收藏。
  bool isFavorite(String id) => _favorites.any((station) => station.id == id);

  // 切换收藏状态并持久化，首版不依赖账户或写入 API。
  Future<void> toggleFavorite(Station station) async {
    if (isFavorite(station.id)) {
      _favorites.removeWhere((item) => item.id == station.id);
    } else {
      _favorites.insert(0, station);
    }
    notifyListeners();
    await _preferences.setString('favorite_stations', _encode(_favorites));
  }

  // 将播放过的电台移到历史顶部，最多保留 30 条。
  Future<void> recordPlayed(Station station) async {
    _recent.removeWhere((item) => item.id == station.id);
    _recent.insert(0, station);
    if (_recent.length > 30) _recent.removeRange(30, _recent.length);
    notifyListeners();
    await _preferences.setString('recent_stations', _encode(_recent));
  }

  // 把持久化 JSON 解析为电台模型，单条无效记录不阻断其余记录。
  List<Station> _decode(String? raw) {
    if (raw == null) return [];
    try {
      final values = jsonDecode(raw) as List<dynamic>;
      final stations = <Station>[];
      for (final value in values) {
        if (value is! Map<String, dynamic>) continue;
        try {
          stations.add(Station.fromJson(value));
        } catch (_) {
          // 跳过损坏的单条记录，保留其他可用的收藏或历史。
        }
      }
      return stations;
    } catch (_) {
      return [];
    }
  }

  // 仅存储列表界面需要的电台字段。
  String _encode(List<Station> stations) =>
      jsonEncode(stations.map((station) => station.toJson()).toList());
}
