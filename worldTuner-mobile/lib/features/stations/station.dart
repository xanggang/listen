// 来自 API 的电台详情，只保留移动界面和播放器使用的字段。
class Station {
  // 保存播放、列表和本地收藏共同需要的电台信息。
  const Station({
    required this.id,
    required this.name,
    required this.url,
    this.urlResolved,
    this.favicon,
    this.country,
    this.language,
    this.codec,
    this.votes,
    this.geoLat,
    this.geoLong,
  });

  final int id;
  final String name;
  final String url;
  final String? urlResolved;
  final String? favicon;
  final String? country;
  final String? language;
  final String? codec;
  final int? votes;
  final double? geoLat;
  final double? geoLong;

  // 优先使用数据库解析过的流地址；无效地址由播放器报告错误。
  String get streamUrl => urlResolved?.isNotEmpty == true ? urlResolved! : url;

  // 将 API 的可空 JSON 字段安全转换为客户端模型。
  factory Station.fromJson(Map<String, dynamic> json) {
    return Station(
      id: (json['id'] as num).toInt(),
      name: (json['name'] as String?)?.trim().isNotEmpty == true
          ? (json['name'] as String).trim()
          : 'Unknown station',
      url: (json['url'] as String?) ?? '',
      urlResolved: json['urlResolved'] as String?,
      favicon: json['favicon'] as String?,
      country: json['country'] as String?,
      language: json['language'] as String?,
      codec: json['codec'] as String?,
      votes: (json['votes'] as num?)?.toInt(),
      geoLat: (json['geoLat'] as num?)?.toDouble(),
      geoLong: (json['geoLong'] as num?)?.toDouble(),
    );
  }

  // 将本地收藏需要的字段序列化，避免保存完整 API 响应。
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'url': url,
    'urlResolved': urlResolved,
    'favicon': favicon,
    'country': country,
    'language': language,
    'codec': codec,
    'votes': votes,
    'geoLat': geoLat,
    'geoLong': geoLong,
  };
}

// 一页电台及 API 提供的后续页信息。
class StationPage {
  // 保存一页结果及后续分页游标。
  const StationPage({required this.list, required this.hasMore, this.nextPage});

  final List<Station> list;
  final bool hasMore;
  final int? nextPage;

  // 解析列表响应，避免界面重复处理 HTTP 字段。
  factory StationPage.fromJson(Map<String, dynamic> json) {
    final rows = (json['list'] as List<dynamic>?) ?? const [];
    return StationPage(
      list: rows
          .map((row) => Station.fromJson(row as Map<String, dynamic>))
          .toList(),
      hasMore: json['hasMore'] == true,
      nextPage: (json['nextPage'] as num?)?.toInt(),
    );
  }
}

// 榜单筛选器的语言或标签选项。
class CatalogItem {
  // 保存筛选字典的标识、名称与可选电台数。
  const CatalogItem({required this.id, required this.name, this.stationCount});

  final int id;
  final String name;
  final int? stationCount;

  // 解析字典项，过滤展示层不需要的数据库字段。
  factory CatalogItem.fromJson(Map<String, dynamic> json) => CatalogItem(
    id: (json['id'] as num).toInt(),
    name: (json['name'] as String?) ?? '',
    stationCount: (json['stationcount'] as num?)?.toInt(),
  );
}
