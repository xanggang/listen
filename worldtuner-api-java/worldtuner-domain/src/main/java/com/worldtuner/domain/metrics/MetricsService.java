package com.worldtuner.domain.metrics;

import com.worldtuner.domain.repository.metrics.MetricsMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/**
 * 访问统计业务服务：日期口径、匿名化与周期汇总。
 * 与 Worker 版 metrics.service.ts 语义一致；写入限定在独立统计库事务中。
 */
@Service
public class MetricsService {

  // 日去重标识保留 35 天；与 Worker 版保留窗口一致。
  private static final long DAILY_RETENTION_MILLIS = 35L * 24 * 60 * 60 * 1000;

  // 月去重标识保留最近两个月。
  private static final long MONTHLY_RETENTION_MONTHS = 2;

  private final MetricsMapper mapper;

  /**
   * 注入独立统计库 mapper。
   *
   * @param mapper 统计 mapper
   */
  public MetricsService(MetricsMapper mapper) {
    this.mapper = mapper;
  }

  /**
   * 以服务端接收时间作为 UTC 日期，避免客户端时间篡改统计日期；原子写入 PV 与日、月去重值。
   * 事务绑定统计库事务管理器，保证三条语句同生共死。
   *
   * @param input 已校验的上报输入
   */
  @Transactional(transactionManager = "metricsTransactionManager")
  public void recordVisit(VisitInput input) {
    Instant now = Instant.now();
    String day = now.truncatedTo(ChronoUnit.DAYS).toString().substring(0, 10);
    String month = day.substring(0, 7);
    mapper.incrementDailyViews(day, input.source(), input.page());
    mapper.insertDailyUnique(day, input.source(), VisitInput.scopedHash("day:" + day, input.visitorId()));
    mapper.insertMonthlyUnique(month, input.source(),
        VisitInput.scopedHash("month:" + month, input.visitorId()));
  }

  /**
   * 汇总已结束周期；日标识保留 35 天，月标识保留最近两个月。
   * 由定时任务在每日 UTC 00:10 触发，与 Worker 的 cron 语义一致。
   */
  @Transactional(transactionManager = "metricsTransactionManager")
  public void rollup() {
    Instant now = Instant.now();
    String day = now.truncatedTo(ChronoUnit.DAYS).toString().substring(0, 10);
    String month = day.substring(0, 7);
    String dailyCutoff = Instant.ofEpochMilli(now.toEpochMilli() - DAILY_RETENTION_MILLIS)
        .truncatedTo(ChronoUnit.DAYS).toString().substring(0, 10);
    String monthlyCutoff = now.atZone(ZoneOffset.UTC)
        .minusMonths(MONTHLY_RETENTION_MONTHS)
        .toLocalDate().withDayOfMonth(1).toString().substring(0, 7);
    mapper.rollupDailyUv(day);
    mapper.rollupMonthlyMau(month);
    mapper.purgeDailyUnique(dailyCutoff);
    mapper.purgeMonthlyUnique(monthlyCutoff);
  }
}
