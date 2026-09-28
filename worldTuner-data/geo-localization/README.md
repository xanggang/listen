# Radio Garden 地区名本地化

本目录只负责已采集数据的名称映射，不请求 Radio Garden 接口，不包含爬虫逻辑。当前范围是 `radio_garden_places.country` 的 225 个国家或地区名称；地点 `title` 仍保留原文。

先运行 `npm run normalize:radio-garden` 生成地点表，然后在 `worldTuner-data/` 运行：

```bash
npm run localize:radio-garden:countries
```

首次运行从 Unicode CLDR 的 [英文](https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-localenames-full/main/en/territories.json)和[中文](https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-localenames-full/main/zh/territories.json)名称表各请求一次。完整映射写入本地 `radio-garden/data/radio-garden.sqlite` 的 `radio_garden_country_names` 表；再次运行直接使用已有映射，不请求网络。需要主动更新 CLDR 时加 `-- --refresh`。下载失败、地区名称无法唯一匹配或中文名缺失时，不替换已有结果。

名称表保留 `name_en`、`name_zh`、`region_code`、`source` 与 `updated_at`。`radio_garden_places_zh` 视图通过英文名关联地点，提供 `country_zh` 和 `country_code`，不修改爬虫保存的原始名称：

```sql
SELECT id, title, country, country_zh, country_code, latitude, longitude
FROM radio_garden_places_zh LIMIT 10;
```

大部分名称按 CLDR 地区代码匹配。Radio Garden 的个别别名通过明确的代码映射；Madeira、Tahiti、Azores 没有相应的 CLDR 国家或地区代码，以手工中文名称保存且 `region_code` 为 `NULL`。地点名需要另做地理实体匹配，不能仅凭英文 `title` 批量翻译；此命令不处理地点名。
