package com.worldtuner.domain.repository.catalog;

import com.worldtuner.domain.catalog.CatalogKind;
import org.apache.ibatis.annotations.Param;

/**
 * 字典 SQL 提供者：表名与关系字段只允许来自 CatalogKind 固定映射，满足
 * 「无法绑定的标识符只允许来自代码固定映射」的项目规范。
 */
public final class CatalogSqlProvider {

  // 公开列表、分类计数共用的可见性条件；SQL 别名固定为 s，与 Worker 版 catalog-policy 一致。
  private static final String PUBLIC_STATION =
      "s.visibility_status = 'visible' AND s.catalog_status != 'unavailable'";

  /** 工具类不需要实例化。 */
  private CatalogSqlProvider() {
  }

  /**
   * 生成语种列表 SQL；统计口径与电台可见性保持一致。
   *
   * @param limit 最大返回条数
   * @return 可执行 SQL
   */
  public static String selectLanguages(@Param("limit") int limit) {
    return catalogSql(CatalogKind.LANGUAGES, true) + " GROUP BY x.id ORDER BY stationcount DESC, x.id ASC LIMIT #{limit}";
  }

  /**
   * 生成国家列表 SQL；国家不返回中英文译名字段。
   *
   * @param limit 最大返回条数
   * @return 可执行 SQL
   */
  public static String selectCountries(@Param("limit") int limit) {
    return catalogSql(CatalogKind.COUNTRIES, false) + " GROUP BY x.id ORDER BY stationcount DESC, x.id ASC LIMIT #{limit}";
  }

  /**
   * 生成标签搜索 SQL；三个名称字段做字面匹配，空关键词由恒真条件覆盖。
   *
   * @param pattern 已转义的 LIKE 模式
   * @param limit   最大返回条数
   * @param offset  翻页偏移量
   * @return 可执行 SQL
   */
  public static String searchTags(@Param("pattern") String pattern, @Param("limit") int limit,
      @Param("offset") int offset) {
    return catalogSql(CatalogKind.TAGS, true)
        + " AND (#{pattern} = '' OR x.name LIKE #{pattern} ESCAPE '\\' OR x.name_en LIKE #{pattern} ESCAPE '\\' OR x.name_zh LIKE #{pattern} ESCAPE '\\')"
        + " GROUP BY x.id ORDER BY stationcount DESC, x.id ASC LIMIT #{limit} OFFSET #{offset}";
  }

  /**
   * 构建字典查询的 SELECT 与 WHERE 前缀；字段清单按字典类型固定。
   *
   * @param kind     字典类型，来自代码固定枚举
   * @param localized 是否输出 name_en / name_zh 译名字段
   * @return SQL 前缀（SELECT ... FROM ... WHERE ...）
   */
  private static String catalogSql(CatalogKind kind, boolean localized) {
    String columns = localized
        ? "x.id, x.name, x.name_en AS nameEn, x.name_zh AS nameZh, COUNT(*) AS stationcount"
        : "x.id, x.name, x.code, COUNT(*) AS stationcount";
    String languageCode = kind == CatalogKind.LANGUAGES ? ", x.code" : "";
    String join;
    if (kind == CatalogKind.COUNTRIES) {
      join = "FROM country x JOIN station s ON s.country_id = x.id";
    } else {
      join = "FROM " + kind.getTable() + " x JOIN " + kind.getRelationTable()
          + " r ON r." + kind.getRelationColumn() + " = x.id JOIN station s ON s.id = r.station_id";
    }
    return "SELECT " + columns + languageCode + " " + join + " WHERE " + PUBLIC_STATION;
  }
}
