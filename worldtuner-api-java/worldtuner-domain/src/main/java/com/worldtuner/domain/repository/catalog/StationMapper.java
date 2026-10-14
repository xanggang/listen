package com.worldtuner.domain.repository.catalog;

import com.worldtuner.domain.stations.LinkRow;
import com.worldtuner.domain.stations.StationQuery;
import com.worldtuner.domain.stations.StationRow;
import com.worldtuner.domain.stations.StreamRow;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.SelectProvider;

import java.util.List;

/**
 * 电台数据访问：SQL 与 Worker 版 stations.repository.ts 保持一致。
 * 列表与详情共用同一投影，保证默认播放流选择和译名聚合口径相同。
 */
public interface StationMapper {

  /**
   * 读取公开电台详情行；隐藏、不可用和不存在的电台均返回 null。
   *
   * @param id 19 位十进制电台 ID
   * @return 电台行；不存在或不可见时为 null
   */
  @SelectProvider(type = StationSqlProvider.class, method = "findById")
  StationRow findById(@Param("id") String id);

  /**
   * 按关联 ID 精确筛选并稳定分页；多读一条记录由服务层判断是否有下一页。
   *
   * @param query   已校验的查询参数
   * @param pattern 关键词的 LIKE 模式；空关键词时为 null，SQL 不引用
   * @param limit   pageSize + 1，用于判断下一页
   * @return 电台行列表
   */
  @SelectProvider(type = StationSqlProvider.class, method = "findPage")
  List<StationRow> findPage(@Param("query") StationQuery query, @Param("pattern") String pattern,
      @Param("limit") int limit);

  /**
   * 读取全部 HTTP(S) 播放流，排序与列表的默认播放流保持一致。
   *
   * @param id 19 位十进制电台 ID
   * @return 播放流行列表
   */
  @SelectProvider(type = StationSqlProvider.class, method = "findStreams")
  List<StreamRow> findStreams(@Param("id") String id);

  /**
   * 读取网站和社交链接，按 ID 稳定排序。
   *
   * @param id 19 位十进制电台 ID
   * @return 外链行列表
   */
  @Select("SELECT id, platform, url FROM station_link WHERE station_id = #{id} ORDER BY id")
  List<LinkRow> findLinks(@Param("id") String id);
}
