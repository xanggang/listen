package com.worldtuner.bootstrap;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.system.ApplicationHome;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * WorldTuner API Java 版启动入口。
 * 装配公开 API 与管理 API；目录库与统计库分别扫描各自的 mapper 包。
 */
@SpringBootApplication(scanBasePackages = {
    "com.worldtuner.bootstrap", "com.worldtuner.domain",
    "com.worldtuner.client", "com.worldtuner.admin"})
@EnableScheduling
@ConfigurationPropertiesScan
@MapperScan(basePackages = "com.worldtuner.domain.repository.catalog",
    sqlSessionFactoryRef = "catalogSqlSessionFactory")
@MapperScan(basePackages = "com.worldtuner.domain.repository.metrics",
    sqlSessionFactoryRef = "metricsSqlSessionFactory")
public class WorldTunerApplication {

  /**
   * 在日志系统初始化前指定 JAR 所在目录，再启动应用；开发时使用启动目录。
   *
   * @param args 命令行参数
   */
  public static void main(String[] args) {
    ApplicationHome home = new ApplicationHome(WorldTunerApplication.class);
    String logDirectory = home.getSource() != null && home.getSource().isFile()
        ? home.getDir().getAbsolutePath() : System.getProperty("user.dir");
    System.setProperty("worldtuner.log-dir", logDirectory);
    SpringApplication.run(WorldTunerApplication.class, args);
  }
}
