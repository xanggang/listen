import 'package:shared_preferences/shared_preferences.dart';

// 首版无账户体系，只记录用户是否已离开欢迎页。
class EntryStore {
  // 使用共享的本地偏好实例保存欢迎页完成状态。
  EntryStore(this._preferences);

  static const _enteredKey = 'entry_completed';
  final SharedPreferencesAsync _preferences;
  bool entered = false;

  // 从设备本地恢复进入状态；未保存时展示欢迎页。
  Future<void> load() async {
    entered = await _preferences.getBool(_enteredKey) ?? false;
  }

  // 标记用户已进入应用，不创建账户也不调用登录接口。
  Future<void> markEntered() async {
    await _preferences.setBool(_enteredKey, true);
    entered = true;
  }
}
