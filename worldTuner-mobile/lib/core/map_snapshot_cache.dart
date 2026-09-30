import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

// 保存 HTTP 缓存正文、ETag 与绝对过期时间，不包含用户信息。
class CachedMapSnapshot {
  // 正文保存原始 JSON，过期后仍可用于 304 条件请求。
  const CachedMapSnapshot({
    required this.body,
    required this.etag,
    required this.expiresAt,
  });
  final String body;
  final String? etag;
  final DateTime expiresAt;
}

// 客户端缓存抽象；测试可注入内存实现，不依赖设备文件系统。
abstract interface class MapSnapshotCache {
  // 读取指定 API 来源的快照，缓存不存在时返回 null。
  Future<CachedMapSnapshot?> read(Uri origin);
  // 保存快照，存储故障不能中断地图加载。
  Future<void> write(Uri origin, CachedMapSnapshot snapshot);
}

// 将地图快照以 gzip 文件保存到应用缓存目录，系统可以安全清理该文件。
class FileMapSnapshotCache implements MapSnapshotCache {
  // 可注入临时目录便于验证；默认使用 Android 应用缓存目录。
  FileMapSnapshotCache({Future<Directory> Function()? directory})
    : _directory = directory ?? getApplicationCacheDirectory;
  final Future<Directory> Function() _directory;

  // 获取唯一的版本化缓存文件；文件内验证 API 来源，防止环境间串用数据。
  Future<File> _file() async {
    final directory = await _directory();
    return File('${directory.path}/worldtuner-map-tuple-1.json.gz');
  }

  // 缺失、损坏或其他服务来源的缓存都当作未命中，重新从 API 获取。
  @override
  Future<CachedMapSnapshot?> read(Uri origin) async {
    try {
      final file = await _file();
      if (!await file.exists()) return null;
      final value = jsonDecode(
        utf8.decode(gzip.decode(await file.readAsBytes())),
      );
      if (value is! Map<String, dynamic> ||
          value['origin'] != origin.toString() ||
          value['body'] is! String ||
          value['expiresAt'] is! int ||
          (value['etag'] != null && value['etag'] is! String)) {
        return null;
      }
      return CachedMapSnapshot(
        body: value['body'] as String,
        etag: value['etag'] as String?,
        expiresAt: DateTime.fromMillisecondsSinceEpoch(
          value['expiresAt'] as int,
        ),
      );
    } catch (_) {
      return null;
    }
  }

  // 原子替换缓存文件；即使空间不足或系统清理目录，网络结果仍可展示。
  @override
  Future<void> write(Uri origin, CachedMapSnapshot snapshot) async {
    try {
      final file = await _file();
      await file.parent.create(recursive: true);
      final temporary = File('${file.path}.tmp');
      final bytes = gzip.encode(
        utf8.encode(
          jsonEncode({
            'origin': origin.toString(),
            'body': snapshot.body,
            'etag': snapshot.etag,
            'expiresAt': snapshot.expiresAt.millisecondsSinceEpoch,
          }),
        ),
      );
      await temporary.writeAsBytes(bytes, flush: true);
      await temporary.rename(file.path);
    } catch (_) {
      // 缓存是可丢弃的加速数据，写入失败不会影响 API 结果。
    }
  }
}
