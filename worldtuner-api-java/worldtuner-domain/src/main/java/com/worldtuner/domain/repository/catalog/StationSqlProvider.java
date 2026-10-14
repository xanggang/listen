package com.worldtuner.domain.repository.catalog;

import com.worldtuner.domain.stations.StationQuery;
import org.apache.ibatis.annotations.Param;

/**
 * 电台 SQL 提供者：投影、连接与筛选条件从 Worker 版平移，固定别名 s / st / c。
 * 所有条件值一律通过 #{} 参数绑定传入。
 */
public final class StationSqlProvider {

  // 公开列表、分类计数、地图及详情共用的可见性条件；别名固定为 s。
  private static final String PUBLIC_STATION =
      "s.visibility_status = 'visible' AND s.catalog_status != 'unavailable'";

  // 优先非失败流，再取首选流；固定 ID 用于稳定选择，空流不会冒充可播放地址。
  private static final String STREAM_ORDER =
      "CASE WHEN st.last_check_ok = 0 THEN 1 ELSE 0 END, st.is_primary DESC, st.id ASC";

  // 只允许 HTTP(S) 流参与默认流选择。
  private static final String HTTP_STREAM = "st.url LIKE 'http://%' OR st.url LIKE 'https://%'";

  // 列表与详情共用的投影；group_concat 子查询固定按字典 ID 排序，保证输出稳定。
  private static final String PROJECTION = """
      s.id, s.name, s.website, s.favicon,
      s.place, s.country_id AS countryId, s.latitude AS geoLat, s.longitude AS geoLong,
      s.votes, s.clickcount, s.source_type AS sourceType, s.catalog_status AS catalogStatus,
      s.created_at AS createdAt, s.updated_at AS updatedAt,
      c.name AS country, c.code AS countrycode,
      st.url, st.resolved_url AS urlResolved, st.codec, st.bitrate,
      st.is_hls AS hls, st.last_check_ok AS lastcheckok,
      (SELECT group_concat(name, ',') FROM (SELECT t.name FROM station_tag r JOIN tag t ON t.id = r.tag_id WHERE r.station_id = s.id ORDER BY t.id)) AS tags,
      (SELECT group_concat(name, ',') FROM (SELECT l.name FROM station_language r JOIN language l ON l.id = r.language_id WHERE r.station_id = s.id ORDER BY l.id)) AS language,
      (SELECT group_concat(label, ',') FROM (SELECT coalesce(nullif(trim(l.name_en), ''), l.name) AS label FROM station_language r JOIN language l ON l.id = r.language_id WHERE r.station_id = s.id ORDER BY l.id)) AS languageEn,
      (SELECT group_concat(label, ',') FROM (SELECT coalesce(nullif(trim(l.name_zh), ''), nullif(trim(l.name_en), ''), l.name) AS label FROM station_language r JOIN language l ON l.id = r.language_id WHERE r.station_id = s.id ORDER BY l.id)) AS languageZh,
      (SELECT group_concat(code, ',') FROM (SELECT l.code FROM station_language r JOIN language l ON l.id = r.language_id WHERE r.station_id = s.id ORDER BY l.id)) AS languagecodes""";

  // 详情与列表共用的连接；默认流只取一条 HTTP(S) 流。
  private static final String JOINS = """
      LEFT JOIN country c ON c.id = s.country_id
      LEFT JOIN station_stream st ON st.id = (
        SELECT st.id FROM station_stream st WHERE st.station_id = s.id
        AND (""" + HTTP_STREAM + ") ORDER BY " + STREAM_ORDER + " LIMIT 1)";

  /** 工具类不需要实例化。 */
  private StationSqlProvider() {
  }

  /**
   * 生成详情 SQL；只返回公开电台。
   *
   * @param id 19 位十进制电台 ID
   * @return 可执行 SQL
   */
  public static String findById(@Param("id") String id) {
    return "SELECT " + PROJECTION + " FROM station s " + JOINS
        + " WHERE " + PUBLIC_STATION + " AND s.id = #{id}";
  }

  /**
   * 生成列表 SQL；关联 ID 精确筛选，关键词覆盖名称、地点、国家与标签/语种的三种名称。
   *
   * @param query   已校验的查询参数
   * @param pattern 关键词的 LIKE 模式；空关键词时 SQL 不引用该参数
   * @param limit   pageSize + 1，用于判断下一页
   * @return 可执行 SQL
   */
  public static String findPage(@Param("query") StationQuery query,
      @Param("pattern") String pattern, @Param("limit") int limit) {
    StringBuilder where = new StringBuilder(PUBLIC_STATION);
    if (query.countriesId() != null) {
      where.append(" AND s.country_id = #{query.countriesId}");
    }
    if (query.tagsId() != null) {
      where.append(" AND EXISTS (SELECT 1 FROM station_tag r WHERE r.station_id = s.id AND r.tag_id = #{query.tagsId})");
    }
    if (query.languagesId() != null) {
      where.append(" AND EXISTS (SELECT 1 FROM station_language r WHERE r.station_id = s.id AND r.language_id = #{query.languagesId})");
    }
    if (!query.keyword().isEmpty()) {
      // 名称、地点、国家与标签/语言的三种名称共九个字面匹配参数。
      where.append("""
          AND (s.name LIKE #{pattern} ESCAPE '\\' OR s.place LIKE #{pattern} ESCAPE '\\' OR c.name LIKE #{pattern} ESCAPE '\\'
            OR EXISTS (SELECT 1 FROM station_tag r JOIN tag t ON t.id = r.tag_id WHERE r.station_id = s.id AND (t.name LIKE #{pattern} ESCAPE '\\' OR t.name_en LIKE #{pattern} ESCAPE '\\' OR t.name_zh LIKE #{pattern} ESCAPE '\\'))
            OR EXISTS (SELECT 1 FROM station_language r JOIN language l ON l.id = r.language_id WHERE r.station_id = s.id AND (l.name LIKE #{pattern} ESCAPE '\\' OR l.name_en LIKE #{pattern} ESCAPE '\\' OR l.name_zh LIKE #{pattern} ESCAPE '\\')))""");
    }
    return "SELECT " + PROJECTION + " FROM station s " + JOINS
        + " WHERE " + where
        + " ORDER BY s.votes DESC, s.id ASC LIMIT #{limit} OFFSET #{query.offset}";
  }

  /**
   * 生成播放流列表 SQL；排序与默认流选择保持一致。
   *
   * @param id 19 位十进制电台 ID
   * @return 可执行 SQL
   */
  public static String findStreams(@Param("id") String id) {
    return """
        SELECT st.id, st.url, st.resolved_url AS urlResolved, st.codec, st.bitrate,
          st.is_hls AS hls, st.is_primary AS isPrimary, st.last_check_ok AS lastcheckok,
          st.last_checked_at AS lastCheckedAt, st.resolved_at AS resolvedAt
        FROM station_stream st WHERE st.station_id = #{id}
        AND (""" + HTTP_STREAM + ") ORDER BY " + STREAM_ORDER;
  }
}
