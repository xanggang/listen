package com.worldtuner.domain.repository.metrics;

import com.worldtuner.domain.metrics.VisitInput;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

/**
 * 访问统计数据访问：所有 SQL 限定在独立统计表，不读取电台或用户业务数据。
 * 语句与 Worker 版 metrics.repository.ts 一致。
 */
public interface MetricsMapper {

  /**
   * 原子累加一次页面访问量；同日同源同页面只增加 PV。
   *
   * @param day    UTC 日期，格式 yyyy-MM-dd
   * @param source 来源平台
   * @param page   固定页面名
   */
  @Insert("""
      INSERT INTO metric_daily_views(day, source, page, pv) VALUES(#{day}, #{source}, #{page}, 1)
      ON CONFLICT(day, source, page) DO UPDATE SET pv = pv + 1""")
  void incrementDailyViews(@Param("day") String day, @Param("source") String source,
      @Param("page") String page);

  /**
   * 记录日去重标识；重复访问忽略。
   *
   * @param day         UTC 日期
   * @param source      来源平台
   * @param visitorHash 日作用域匿名哈希
   */
  @Insert("INSERT OR IGNORE INTO metric_daily_unique(day, source, visitor_hash) VALUES(#{day}, #{source}, #{visitorHash})")
  void insertDailyUnique(@Param("day") String day, @Param("source") String source,
      @Param("visitorHash") String visitorHash);

  /**
   * 记录月去重标识；重复访问忽略。
   *
   * @param month       UTC 月份，格式 yyyy-MM
   * @param source      来源平台
   * @param visitorHash 月作用域匿名哈希
   */
  @Insert("INSERT OR IGNORE INTO metric_monthly_unique(month, source, visitor_hash) VALUES(#{month}, #{source}, #{visitorHash})")
  void insertMonthlyUnique(@Param("month") String month, @Param("source") String source,
      @Param("visitorHash") String visitorHash);

  /**
   * 汇总已结束日期的日 UV。
   *
   * @param currentDay 当前 UTC 日期，早于该日期的记录参与汇总
   */
  @Update("""
      INSERT INTO metric_daily_uv(day, source, uv)
      SELECT day, source, COUNT(*) FROM metric_daily_unique
      WHERE day < #{currentDay} GROUP BY day, source
      ON CONFLICT(day, source) DO UPDATE SET uv = excluded.uv""")
  void rollupDailyUv(@Param("currentDay") String currentDay);

  /**
   * 汇总已结束月份的月活跃值。
   *
   * @param currentMonth 当前 UTC 月份，早于该月份的记录参与汇总
   */
  @Update("""
      INSERT INTO metric_monthly_mau(month, source, mau)
      SELECT month, source, COUNT(*) FROM metric_monthly_unique
      WHERE month < #{currentMonth} GROUP BY month, source
      ON CONFLICT(month, source) DO UPDATE SET mau = excluded.mau""")
  void rollupMonthlyMau(@Param("currentMonth") String currentMonth);

  /**
   * 清理超过保留期的日去重标识。
   *
   * @param cutoff 保留窗口下限日期
   */
  @Update("DELETE FROM metric_daily_unique WHERE day < #{cutoff}")
  void purgeDailyUnique(@Param("cutoff") String cutoff);

  /**
   * 清理超过保留期的月去重标识。
   *
   * @param cutoff 保留窗口下限月份
   */
  @Update("DELETE FROM metric_monthly_unique WHERE month < #{cutoff}")
  void purgeMonthlyUnique(@Param("cutoff") String cutoff);
}
