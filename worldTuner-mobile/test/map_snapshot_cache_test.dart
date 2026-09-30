import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:worldtuner_mobile/core/map_snapshot_cache.dart';

// 使用临时目录验证真实 gzip 文件，不接触设备已有缓存。
void main() {
  test('gzip snapshot survives reopening and isolates API origins', () async {
    final directory = await Directory.systemTemp.createTemp('worldtuner-map-');
    // 测试完成后移除临时缓存。
    addTearDown(() => directory.delete(recursive: true));
    final store = FileMapSnapshotCache(
      // 使用隔离目录替代 Android path_provider。
      directory: () async => directory,
    );
    final origin = Uri.parse('https://api.test');
    final snapshot = CachedMapSnapshot(
      body: '{"data":{"count":0,"points":[]}}',
      etag: 'W/"test"',
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    await store.write(origin, snapshot);
    expect((await store.read(origin))?.body, snapshot.body);
    expect(await store.read(Uri.parse('https://other.test')), isNull);
    final file = File('${directory.path}/worldtuner-map-tuple-1.json.gz');
    expect((await file.readAsBytes()).take(2), [0x1f, 0x8b]);
    await file.writeAsString('corrupted');
    expect(await store.read(origin), isNull);
  });
}
