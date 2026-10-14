package com.worldtuner.bootstrap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;

/**
 * 统计库建表初始化：启动时执行 CREATE TABLE IF NOT EXISTS 脚本。
 * 表结构与 worldTuner-api/migrations/0002_visit_metrics.sql 一致。
 */
@Component
public class MetricsSchemaInitializer implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(MetricsSchemaInitializer.class);

  private final DataSource metricsDataSource;

  /**
   * 注入统计库数据源。
   *
   * @param metricsDataSource 统计库数据源
   */
  public MetricsSchemaInitializer(
      @org.springframework.beans.factory.annotation.Qualifier("metricsDataSource")
      DataSource metricsDataSource) {
    this.metricsDataSource = metricsDataSource;
  }

  /**
   * 启动时确保统计表存在；幂等执行，不影响已有数据。
   *
   * @param args 命令行参数
   * @throws Exception 建表失败时抛出，阻止服务以不可用状态启动
   */
  @Override
  public void run(ApplicationArguments args) throws Exception {
    try (Connection connection = metricsDataSource.getConnection()) {
      ScriptUtils.executeSqlScript(connection, new EncodedResource(
          new ClassPathResource("schema/metrics.sql"), StandardCharsets.UTF_8));
    }
    log.info("metrics schema initialized");
  }
}
