package com.worldtuner.bootstrap;

import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.sqlite.SQLiteConfig;

import javax.sql.DataSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/**
 * 双数据源装配：目录库（业务只读，管理端少量写）与统计库（读写）分开。
 * mapper 按包自动路由：repository.catalog 走目录库，repository.metrics 走统计库。
 */
@Configuration
public class DataSourceConfig {

  /**
   * 应用配置属性（构造器绑定）。
   *
   * @param catalogDbPath         目录库 SQLite 文件路径
   * @param metricsDbPath         统计库 SQLite 文件路径
   * @param mapSnapshotTtlSeconds 地图快照缓存秒数；0 禁用
   * @param allowedOrigins        CORS 白名单，逗号分隔
   * @param cacheEnabled          是否启用进程内 JSON 缓存
   * @param adminToken            管理端静态 Token
   * @param readLimitPerMinute    只读接口限流（每分钟每 IP）
   * @param searchLimitPerMinute  关键词搜索限流（每分钟每 IP）
   * @param metricsLimitPerMinute 统计写入限流（每分钟每 IP）
   */
  @ConfigurationProperties(prefix = "worldtuner")
  public record WorldTunerProps(
      String catalogDbPath,
      String metricsDbPath,
      int mapSnapshotTtlSeconds,
      String allowedOrigins,
      boolean cacheEnabled,
      String adminToken,
      int readLimitPerMinute,
      int searchLimitPerMinute,
      int metricsLimitPerMinute) {
  }

  /**
   * 创建目录库数据源；只读业务查询共用此连接池。
   * SQLite 驱动按需打开文件，连接池容量保持较小即可覆盖并发读取。
   *
   * @param props 应用配置
   * @return 目录库数据源
   */
  @Bean
  public DataSource catalogDataSource(WorldTunerProps props) {
    return buildDataSource(props.catalogDbPath(), false);
  }

  /**
   * 创建统计库数据源；启用 WAL 与 busy_timeout，写连接池收敛为 1 以规避 SQLite 单写者限制。
   *
   * @param props 应用配置
   * @return 统计库数据源
   */
  @Bean
  public DataSource metricsDataSource(WorldTunerProps props) {
    return buildDataSource(props.metricsDbPath(), true);
  }

  /**
   * 构建 SQLite 数据源：统一开启外键；统计库额外开启 WAL 与 busy_timeout。
   *
   * @param dbPath  数据库文件路径
   * @param writable 是否需要写入能力（决定 WAL 与连接池大小）
   * @return 数据源
   */
  private DataSource buildDataSource(String dbPath, boolean writable) {
    Path path = Path.of(dbPath).toAbsolutePath();
    try {
      Files.createDirectories(path.getParent());
    } catch (IOException e) {
      throw new IllegalStateException("cannot create database directory: " + path.getParent(), e);
    }
    Properties properties = new Properties();
    properties.setProperty(SQLiteConfig.Pragma.FOREIGN_KEYS.getPragmaName(), "true");
    if (writable) {
      properties.setProperty(SQLiteConfig.Pragma.JOURNAL_MODE.getPragmaName(), "WAL");
      properties.setProperty(SQLiteConfig.Pragma.BUSY_TIMEOUT.getPragmaName(), "5000");
    }
    org.springframework.jdbc.datasource.SimpleDriverDataSource dataSource =
        new org.springframework.jdbc.datasource.SimpleDriverDataSource();
    dataSource.setUrl("jdbc:sqlite:" + path);
    dataSource.setDriverClass(org.sqlite.JDBC.class);
    dataSource.setConnectionProperties(properties);
    return wrapWithPool(dataSource, writable);
  }

  /**
   * 用 HikariCP 包装数据源；统计库写连接收敛为 1，目录库允许多个只读连接。
   *
   * @param dataSource 底层数据源
   * @param writable   是否为统计库（可写）
   * @return 连接池数据源
   */
  private DataSource wrapWithPool(DataSource dataSource, boolean writable) {
    com.zaxxer.hikari.HikariConfig config = new com.zaxxer.hikari.HikariConfig();
    config.setDataSource(dataSource);
    config.setMaximumPoolSize(writable ? 1 : 8);
    config.setPoolName(writable ? "metrics-sqlite" : "catalog-sqlite");
    return new com.zaxxer.hikari.HikariDataSource(config);
  }

  /**
   * 目录库 SqlSessionFactory；mapper 为纯注解声明，无 XML。
   *
   * @param catalogDataSource 目录库数据源
   * @return SqlSessionFactory
   * @throws Exception MyBatis 初始化失败时抛出
   */
  @Bean
  public SqlSessionFactory catalogSqlSessionFactory(
      @Qualifier("catalogDataSource") DataSource catalogDataSource) throws Exception {
    return buildSqlSessionFactory(catalogDataSource);
  }

  /**
   * 统计库 SqlSessionFactory。
   *
   * @param metricsDataSource 统计库数据源
   * @return SqlSessionFactory
   * @throws Exception MyBatis 初始化失败时抛出
   */
  @Bean
  public SqlSessionFactory metricsSqlSessionFactory(
      @Qualifier("metricsDataSource") DataSource metricsDataSource) throws Exception {
    return buildSqlSessionFactory(metricsDataSource);
  }

  /**
   * 构建 SqlSessionFactory：驼峰别名由 SQL 显式 AS 提供，保持 MyBatis 默认映射。
   *
   * @param dataSource 目标数据源
   * @return SqlSessionFactory
   * @throws Exception MyBatis 初始化失败时抛出
   */
  private SqlSessionFactory buildSqlSessionFactory(DataSource dataSource) throws Exception {
    SqlSessionFactoryBean factory = new SqlSessionFactoryBean();
    factory.setDataSource(dataSource);
    return factory.getObject();
  }

  /**
   * 目录库事务管理器；供管理端可见性更新使用。
   *
   * @param catalogDataSource 目录库数据源
   * @return 事务管理器
   */
  @Bean
  public DataSourceTransactionManager catalogTransactionManager(
      @Qualifier("catalogDataSource") DataSource catalogDataSource) {
    return new DataSourceTransactionManager(catalogDataSource);
  }

  /**
   * 统计库事务管理器；供 PV/UV 写入与汇总使用。
   *
   * @param metricsDataSource 统计库数据源
   * @return 事务管理器
   */
  @Bean
  public DataSourceTransactionManager metricsTransactionManager(
      @Qualifier("metricsDataSource") DataSource metricsDataSource) {
    return new DataSourceTransactionManager(metricsDataSource);
  }

  /**
   * 统计库建表与每日汇总任务共用的事务模板。
   *
   * @param metricsTransactionManager 统计库事务管理器
   * @return 事务模板
   */
  @Bean
  public TransactionTemplate metricsTransactionTemplate(
      @Qualifier("metricsTransactionManager") DataSourceTransactionManager metricsTransactionManager) {
    return new TransactionTemplate(metricsTransactionManager);
  }

  /**
   * 目录库写操作事务模板。
   *
   * @param catalogTransactionManager 目录库事务管理器
   * @return 事务模板
   */
  @Bean
  public TransactionTemplate catalogTransactionTemplate(
      @Qualifier("catalogTransactionManager") DataSourceTransactionManager catalogTransactionManager) {
    return new TransactionTemplate(catalogTransactionManager);
  }
}
