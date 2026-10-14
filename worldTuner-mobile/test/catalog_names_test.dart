import 'package:flutter_test/flutter_test.dart';
import 'package:worldtuner_mobile/features/stations/station.dart';

// 验证名称兜底、跨语言搜索和旧收藏兼容，不依赖网络或设备插件。
void main() {
  // 翻译只影响展示，筛选仍使用原始标识。
  test('catalog names keep identity and search all translations', () {
    final item = CatalogItem.fromJson({
      'id': '123',
      'name': '原始',
      'name_en': ' Rock ',
      'name_zh': ' 摇滚 ',
    });
    expect(item.displayName('zh-CN'), '摇滚');
    expect(item.displayName('en'), 'Rock');
    for (final query in ['原始', 'ROCK', '摇滚', '']) {
      expect(item.matches(query), isTrue);
    }
    expect(item.matches('jazz'), isFalse);
    expect(item.id, '123');
    expect(item.name, '原始');
    expect(
      const CatalogItem(
        id: '123',
        name: 'Legacy',
        nameEn: ' ',
        nameZh: ' ',
      ).displayName('zh'),
      'Legacy',
    );
    expect(
      const CatalogItem(
        id: '123',
        name: 'raw',
        nameEn: 'English',
      ).displayName('zh'),
      'English',
    );
  });
  // 收藏往返保留译名；旧记录仍能正常显示原始语种。
  test('saved stations retain translated languages and legacy fallback', () {
    final station = Station.fromJson({
      'id': '123',
      'name': 'Station',
      'url': '',
      'country': 'China',
      'countryEn': 'China',
      'countryZh': '中国',
      'language': 'raw',
      'languageEn': 'English',
      'languageZh': '英语',
    });
    expect(Station.fromJson(station.toJson()).displayLanguage('zh'), '英语');
    expect(station.displayLanguage('en'), 'English');
    expect(Station.fromJson(station.toJson()).displayCountry('zh'), '中国');
    expect(station.displayCountry('en'), 'China');
    expect(
      const CatalogItem(
        id: '123',
        name: 'China',
        nameEn: 'China',
        nameZh: '中国',
        code: 'CN',
      ).matches('cn'),
      isTrue,
    );
    expect(
      const Station(
        id: '123',
        name: 'Station',
        url: '',
        country: 'Legacy',
      ).displayCountry('zh'),
      'Legacy',
    );
    expect(
      const Station(
        id: '123',
        name: 'Station',
        url: '',
        language: 'legacy',
      ).displayLanguage('zh'),
      'legacy',
    );
    expect(
      const Station(id: '123', name: 'Station', url: '').displayLanguage('zh'),
      isNull,
    );
  });
}
