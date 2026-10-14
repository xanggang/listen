package com.worldtuner.bootstrap;

import com.worldtuner.domain.metrics.MetricsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 统计周期汇总任务：每天 UTC 00:10 汇总已结束周期并清理过期去重值。
 * 与 Worker 版 cron 触发器（10 0 * * *）语义一致。
 */
@Component
public class MetricsRollupScheduler {

  private static final Logger log = LoggerFactory.getLogger(MetricsRollupScheduler.class);

  private final MetricsService metricsService;

  /**
   * 注入统计服务。
   *
   * @param metricsService 统计业务服务
   */
  public MetricsRollupScheduler(MetricsService metricsService) {
    this.metricsService = metricsService;
  }

  /**
   * 执行每日汇总；失败仅记录日志，下个周期重试。
   */
  @Scheduled(cron = "0 10 0 * * *", zone = "UTC")
  public void rollup() {
    try {
      metricsService.rollup();
      log.info("metrics rollup completed");
    } catch (Exception e) {
      log.error("metrics rollup failed", e);
    }
  }
}
