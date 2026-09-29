import 'dart:convert';

import 'package:http/http.dart' as http;

import '../features/stations/station.dart';

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
  ApiClient({required this.origin, http.Client? client})
    : _client = client ?? http.Client();

  final Uri origin;
  final http.Client _client;

  // 拼接 API v1 路径和查询参数，不修改配置的 scheme 与 host。
  Uri _uri(String path, Map<String, String> query) {
    final prefix = origin.path.replaceAll(RegExp(r'/$'), '');
    return origin.replace(
      path: '$prefix/api/v1/$path',
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
    int? languageId,
    int? tagId,
    int? countryId,
  }) async {
    final query = <String, String>{'page': '$page', 'pageSize': '$pageSize'};
    if (keyword != null && keyword.trim().isNotEmpty) {
      query['keyword'] = keyword.trim();
    }
    if (languageId != null) query['languagesId'] = '$languageId';
    if (tagId != null) query['tagsId'] = '$tagId';
    if (countryId != null) query['countriesId'] = '$countryId';
    return StationPage.fromJson(
      await _get('stations', query) as Map<String, dynamic>,
    );
  }

  // 地图点选后使用旧版数值 id 获取完整电台信息。
  Future<Station> stationById(int id) async =>
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

  // 关闭底层连接，通常在应用生命周期结束时调用。
  void dispose() => _client.close();
}
