package com.worldtuner.domain.metrics;

import java.util.List;

/**
 * 匿名访问统计的固定口径：允许的页面名与来源。
 * 与 Worker 版 metrics.types.ts 保持一致；新增页面名时两个服务需同步。
 */
public final class MetricPages {

  /** 允许上报的固定页面名。 */
  public static final List<String> PAGES =
      List.of("welcome", "map", "discover", "search", "charts", "settings", "vip", "player");

  /** 允许的来源标识。 */
  public static final List<String> SOURCES = List.of("web", "android");

  /** 工具类不需要实例化。 */
  private MetricPages() {
  }

  /**
   * 判断页面名是否在固定口径内。
   *
   * @param page 页面名
   * @return 允许上报返回 true
   */
  public static boolean isAllowedPage(String page) {
    return PAGES.contains(page);
  }

  /**
   * 判断来源是否在固定口径内。
   *
   * @param source 来源标识
   * @return 允许上报返回 true
   */
  public static boolean isAllowedSource(String source) {
    return SOURCES.contains(source);
  }
}
