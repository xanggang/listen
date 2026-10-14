package com.worldtuner.domain.repository.catalog;

import com.worldtuner.domain.map.MapPoint;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.SelectProvider;

import java.util.List;

/**
 * 地图点位数据访问：SQL 与 Worker 版 map.repository.ts 保持一致。
 * 点位与详情来自同一数据源，ID 语义一致。
 */
public interface MapMapper {

  /**
   * 按 ID 游标读取轻量点位，多读一条判断后续页，避免 8 万点一次返回。
   *
   * @param after 游标：上一页最后一个电台 ID；null 表示第一页
   * @param limit limit + 1，用于判断下一页
   * @return 点位行列表
   */
  @SelectProvider(type = MapSqlProvider.class, method = "findPage")
  List<MapPoint> findPage(@Param("after") String after, @Param("limit") int limit);

  /**
   * 读取所有公开且坐标有效的电台，固定排序保证快照和 ETag 稳定。
   *
   * @return 点位行列表
   */
  @SelectProvider(type = MapSqlProvider.class, method = "findAll")
  List<MapPoint> findAll();
}
