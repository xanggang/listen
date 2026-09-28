import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:worldtuner_mobile/features/onboarding/entry_store.dart';

// 验证首次进入状态只保存在本机，并可在重新创建应用状态后恢复。
void main() {
  // 每个用例都从未进入过应用的设备状态开始。
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('first launch shows entry page and later launches skip it', () async {
    final firstLaunch = EntryStore(SharedPreferencesAsync());
    await firstLaunch.load();
    expect(firstLaunch.entered, isFalse);

    await firstLaunch.markEntered();
    expect(firstLaunch.entered, isTrue);

    final nextLaunch = EntryStore(SharedPreferencesAsync());
    await nextLaunch.load();
    expect(nextLaunch.entered, isTrue);
  });
}
