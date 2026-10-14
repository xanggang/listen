package com.worldtuner.domain.repository.catalog;

import org.apache.ibatis.annotations.Param;

/**
 * 地图点位 SQL 提供者：可见性条件与坐标有效性从 Worker 版平移。
 */
public final class MapSqlProvider {

  // 公开电台条件；别名固定为 s。
  private static final String PUBLIC_STATION =
      "s.visibility_status = 'visible' AND s.catalog_status != 'unavailable'";

  // 坐标有效条件；与建表约束一致，防御历史数据越界。
  private static final String VALID_COORDS =
      "s.latitude BETWEEN -90 AND 90 AND s.longitude BETWEEN -180 AND 180";

  /** 工具类不需要实例化。 */
  private MapSqlProvider() {
  }

  /**
   * 生成游标分页 SQL；按 ID 升序保证游标稳定。
   *
   * @param after 游标 ID，可为 null
   * @param limit limit + 1，用于判断下一页
   * @return 可执行 SQL
   */
  public static String findPage(@Param("after") String after, @Param("limit") int limit) {
    String cursor = after == null ? "" : " AND s.id > #{after}";
    return "SELECT s.id, s.name, s.latitude AS geoLat, s.longitude AS geoLong FROM station s"
        + " WHERE " + PUBLIC_STATION + " AND " + VALID_COORDS + cursor
        + " ORDER BY s.id ASC LIMIT #{limit}";
  }

  /**
   * 生成全量点位 SQL；固定排序保证快照和 ETag 稳定。
   *
   * @return 可执行 SQL
   */
  public static String findAll() {
    return "SELECT s.id, s.name, s.latitude AS geoLat, s.longitude AS geoLong FROM station s"
        + " WHERE " + PUBLIC_STATION + " AND " + VALID_COORDS
        + " ORDER BY s.id ASC";
  }
}
