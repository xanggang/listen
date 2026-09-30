import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'map_snapshot_cache.dart';
import 'package:http/http.dart' as http;

import '../features/stations/station.dart';
import '../features/map/map_point.dart';

// 表示 API 的 HTTP 或响应格式错误，供界面统一显示重试状态。
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

// 只读 API 客户端。根地址由构建环境注入，可替换 HTTP Client 便于测试。
class ApiClient {
  // 注入 API 来源、HTTP 连接和可选持久缓存；默认保留进程内地图缓存。
  ApiClient({required this.origin, http.Client? client, this.snapshotCache})
    : _client = client ?? http.Client();

  final Uri origin;
  final http.Client _client;
  final MapSnapshotCache? snapshotCache;
  CachedMapSnapshot? _snapshot;
  Future<List<MapPoint>>? _snapshotPending;

  // 拼接 API 路径和查询参数，不修改配置的 scheme 与 host。
  Uri _uri(String path, Map<String, String> query) {
    final prefix = origin.path.replaceAll(RegExp(r'/$'), '');
    return origin.replace(
      path: '$prefix/api/$path',
      queryParameters: query.isEmpty ? null : query,
    );
  }

  // 请求并解包 `{data: ...}`；超时、非 200 与坏数据交给调用方处理。
  Future<dynamic> _get(
    String path, [
    Map<String, String> query = const {},
  ]) async {
    try {
      final response = await _client
          .get(_uri(path, query))
          .timeout(const Duration(seconds: 12));
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (response.statusCode != 200) {
        final error = body is Map<String, dynamic> ? body['error'] : null;
        throw ApiException(
          error is Map<String, dynamic>
              ? (error['message'] as String? ?? 'Request failed')
              : 'Request failed',
          statusCode: response.statusCode,
        );
      }
      if (body is! Map<String, dynamic> || !body.containsKey('data')) {
        throw const ApiException('Invalid API response');
      }
      return body['data'];
    } on ApiException {
      rethrow;
    } catch (error) {
      throw ApiException('Network request failed: $error');
    }
  }

  // 读取搜索或榜单的一页电台；API 限制 pageSize 不超过 100。
  Future<StationPage> stations({
    int page = 1,
    int pageSize = 20,
    String? keyword,
    String? languageId,
    String? tagId,
    String? countryId,
  }) async {
    final query = <String, String>{'page': '$page', 'pageSize': '$pageSize'};
    if (keyword != null && keyword.trim().isNotEmpty) {
      query['keyword'] = keyword.trim();
    }
    if (languageId != null) query['languagesId'] = languageId;
    if (tagId != null) query['tagsId'] = tagId;
    if (countryId != null) query['countriesId'] = countryId;
    return StationPage.fromJson(
      await _get('stations', query) as Map<String, dynamic>,
    );
  }

  // 地图点选后按字符串 ID 获取当前数据源的完整详情。
  Future<Station> stationById(String id) async =>
      Station.fromJson(await _get('stations/$id') as Map<String, dynamic>);

  // 读取榜单语言或标签，kind 仅由客户端固定调用点提供。
  Future<List<CatalogItem>> catalog(String kind, {int limit = 30}) async {
    if (kind != 'languages' && kind != 'tags' && kind != 'countries') {
      throw const ApiException('Unsupported catalog');
    }
    final rows = await _get(kind, {'limit': '$limit'}) as List<dynamic>;
    return rows
        .map((row) => CatalogItem.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  // 按名称分页读取标签；空关键词返回热门标签，offset 从 0 开始。
  Future<List<CatalogItem>> searchTags({
    String keyword = '',
    int limit = 30,
    int offset = 0,
  }) async {
    final rows =
        await _get('tags', {
              'q': keyword.trim(),
              'limit': '$limit',
              'offset': '$offset',
            })
            as List<dynamic>;
    return rows
        .map((row) => CatalogItem.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  // 全量点位只请求一次；并发调用共用任务，完成后由 HTTP TTL 决定是否复用正文。
  Future<List<MapPoint>> mapSnapshot() async {
    if (_snapshotPending != null) return _snapshotPending!;
    final pending = _loadMapSnapshot();
    _snapshotPending = pending;
    try {
      return await pending;
    } finally {
      if (identical(_snapshotPending, pending)) _snapshotPending = null;
    }
  }

  // 未过期读取本地正文，过期发送 ETag；200 与 304 才能更新缓存，失败不延长有效期。
  Future<List<MapPoint>> _loadMapSnapshot() async {
    _snapshot ??= await snapshotCache?.read(origin);
    var cached = _snapshot;
    List<MapPoint>? cachedPoints;
    if (cached != null) {
      try {
        final parsed = await compute(MapPoint.parseSnapshot, cached.body);
        cachedPoints = parsed;
        if (cached.expiresAt.isAfter(DateTime.now())) return parsed;
      } catch (_) {
        // 损坏缓存不能阻止重新下载，也不能携带其 ETag 获取无正文的 304。
        cached = null;
        _snapshot = null;
      }
    }
    try {
      final started = DateTime.now();
      final response = await _client
          .get(
            _uri('map/snapshot', const {}),
            headers: {if (cached?.etag != null) 'If-None-Match': cached!.etag!},
          )
          .timeout(const Duration(seconds: 30));
      if (response.statusCode != 200 &&
          !(response.statusCode == 304 && cached != null)) {
        throw ApiException(
          'Map request failed',
          statusCode: response.statusCode,
        );
      }
      // http 的 Android IOClient 自动处理网络 gzip，不重复解压已解码的 bodyBytes。
      final body = response.statusCode == 304
          ? cached!.body
          : utf8.decode(response.bodyBytes);
      final points = response.statusCode == 304
          ? cachedPoints!
          : await compute(MapPoint.parseSnapshot, body);
      final maxAge = RegExp(
        r'(?:^|,)\s*max-age=(\d+)',
      ).firstMatch(response.headers['cache-control'] ?? '');
      final seconds = int.tryParse(maxAge?.group(1) ?? '') ?? 0;
      final age = int.tryParse(response.headers['age'] ?? '') ?? 0;
      final snapshot = CachedMapSnapshot(
        body: body,
        etag:
            response.headers['etag'] ??
            (response.statusCode == 304 ? cached?.etag : null),
        expiresAt: started.add(
          Duration(seconds: (seconds - age).clamp(0, 86400)),
        ),
      );
      _snapshot = snapshot;
      await snapshotCache?.write(origin, snapshot);
      return points;
    } on ApiException {
      rethrow;
    } catch (error) {
      // 网络或响应格式失败不保存结果，下次继续尝试有效的本地快照或下载。
      _snapshot = null;
      throw ApiException('Map request failed: $error');
    }
  }

  // 读取当前库的点位页；游标保持字符串，移动端不再使用旧数据快照。
  Future<MapPointPage> mapPoints({String? after, int limit = 5000}) async {
    final query = <String, String>{'limit': '$limit'};
    if (after != null) query['after'] = after;
    final data = await _get('map/stations', query) as Map<String, dynamic>;
    return MapPointPage(
      list: MapPoint.parseRows(data['list'] as List<dynamic>),
      nextCursor: data['nextCursor'] == null
          ? null
          : parseEntityId(data['nextCursor']),
    );
  }

  // 关闭底层连接，通常在应用生命周期结束时调用。
  void dispose() => _client.close();
}
