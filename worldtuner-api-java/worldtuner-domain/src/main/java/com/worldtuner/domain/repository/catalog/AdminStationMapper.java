package com.worldtuner.domain.repository.catalog;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 管理端电台数据访问：仅包含后台管理需要的最小写操作。
 * 写入的是目录库 station 表的可见性状态，属于 admin 模块专用能力。
 */
public interface AdminStationMapper {

  /**
   * 按实体 ID 检查电台存在性。
   *
   * @param id 19 位十进制电台 ID
   * @return 电台名；不存在时为 null
   */
  @Select("SELECT name FROM station WHERE id = #{id}")
  String findNameById(@Param("id") String id);

  /**
   * 更新电台可见性状态；同步刷新 updated_at。
   *
   * @param id         19 位十进制电台 ID
   * @param visibility 目标状态：visible / hidden
   * @param updatedAt  更新时间（UTC ISO-8601 文本）
   * @return 受影响行数；0 表示状态未变化或条件不满足
   */
  @Update("UPDATE station SET visibility_status = #{visibility}, updated_at = #{updatedAt} WHERE id = #{id}")
  int updateVisibility(@Param("id") String id, @Param("visibility") String visibility,
      @Param("updatedAt") String updatedAt);
}
