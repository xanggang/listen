import 'package:flutter/widgets.dart';

import '../stations/station.dart';

// 列表向主导航发送定位请求；每次点击创建新实例，支持重复定位同一电台。
class StationMapRequest extends Notification {
  // 传递电台数据，只请求地图定位，不修改播放或收藏状态。
  StationMapRequest(this.station);

  final Station station;
}
