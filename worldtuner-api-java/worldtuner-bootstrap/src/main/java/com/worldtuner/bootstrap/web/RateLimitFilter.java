package com.worldtuner.bootstrap.web;

import com.worldtuner.common.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * 访客限流过滤器：普通读取与统计写入使用独立额度；关键词搜索叠加搜索额度。
 * 行为与 Worker 版 middleware/rate-limit.ts 一致；超限抛出统一的 429。
 */
public class RateLimitFilter extends OncePerRequestFilter {

  /** 统计写入路径：使用独立额度，不占用只读额度。 */
  private static final String METRICS_VISIT_PATH = "/api/metrics/visit";

  /** 只读额度适用的方法集合。 */
  private static final Set<String> READ_METHODS = Set.of("GET", "HEAD");

  private final RateLimiter limiter;

  private final int readPerMinute;

  private final int searchPerMinute;

  private final int metricsPerMinute;

  /**
   * 注入限流器与各域阈值。
   *
   * @param limiter          进程内限流器
   * @param readPerMinute    只读额度（每分钟）
   * @param searchPerMinute  搜索额度（每分钟）
   * @param metricsPerMinute 统计写入额度（每分钟）
   */
  public RateLimitFilter(RateLimiter limiter, int readPerMinute, int searchPerMinute,
      int metricsPerMinute) {
    this.limiter = limiter;
    this.readPerMinute = readPerMinute;
    this.searchPerMinute = searchPerMinute;
    this.metricsPerMinute = metricsPerMinute;
  }

  /**
   * 在业务和缓存前扣减额度；统计写入独立计费，关键词搜索叠加搜索额度。
   *
   * @param request     HTTP 请求
   * @param response    HTTP 响应
   * @param filterChain 后续过滤器链
   */
  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String key = clientKey(request);
    // 统计写入使用独立额度；其余请求沿用只读额度。
    boolean metricsWrite = "POST".equalsIgnoreCase(request.getMethod())
        && METRICS_VISIT_PATH.equals(request.getRequestURI());
    if (metricsWrite) {
      if (!limiter.tryAcquire("metrics", key, metricsPerMinute)) {
        throw new ApiError(429, "RATE_LIMITED", "Too many requests");
      }
    } else if (!limiter.tryAcquire("read", key, readPerMinute)) {
      throw new ApiError(429, "RATE_LIMITED", "Too many requests");
    }
    // 仅对包含非空关键词的电台请求叠加搜索额度，避免影响普通列表读取。
    String keyword = request.getParameter("keyword");
    if (READ_METHODS.contains(request.getMethod().toUpperCase(java.util.Locale.ROOT))
        && request.getRequestURI().startsWith("/api/stations")
        && keyword != null && !keyword.isBlank()
        && !limiter.tryAcquire("search", key, searchPerMinute)) {
      throw new ApiError(429, "RATE_LIMITED", "Too many requests");
    }
    filterChain.doFilter(request, response);
  }

  /**
   * 解析客户端 IP：优先 CDN 注入的头，缺失时退回连接地址。
   * IP 限额是访客滥用启发式，不是用户身份识别。
   *
   * @param request HTTP 请求
   * @return 客户端标识
   */
  private String clientKey(HttpServletRequest request) {
    String cfIp = request.getHeader("CF-Connecting-IP");
    if (cfIp != null && !cfIp.isBlank()) {
      return cfIp.trim();
    }
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    String remote = request.getRemoteAddr();
    return remote == null || remote.isBlank() ? "unknown" : remote;
  }
}
