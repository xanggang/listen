package com.worldtuner.bootstrap.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * CORS 过滤器：仅回显配置白名单中的 Origin，避免开放任意浏览器来源。
 * 行为与 Worker 版 middleware/cors.ts 一致；此策略不承担身份认证。
 */
public class CorsFilter extends OncePerRequestFilter {

  /** 允许的 HTTP 方法，与 Worker 版一致。 */
  private static final List<String> ALLOW_METHODS = List.of("GET", "POST", "OPTIONS");

  /** 允许的请求头。 */
  private static final List<String> ALLOW_HEADERS = List.of("Content-Type", "If-None-Match");

  /** 允许客户端读取的响应头。 */
  private static final List<String> EXPOSE_HEADERS = List.of("X-Request-Id", "Retry-After", "ETag");

  private final List<String> allowedOrigins;

  /**
   * 注入来源白名单。
   *
   * @param allowedOrigins 逗号分隔的来源白名单，已去除空白
   */
  public CorsFilter(List<String> allowedOrigins) {
    this.allowedOrigins = allowedOrigins;
  }

  /**
   * 处理跨域：预检请求直接返回 204；实际请求在白名单内时回显 Origin。
   *
   * @param request     HTTP 请求
   * @param response    HTTP 响应
   * @param filterChain 后续过滤器链
   */
  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String origin = request.getHeader("Origin");
    if (origin != null && allowedOrigins.contains(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.addHeader("Vary", "Origin");
      response.setHeader("Access-Control-Expose-Headers", String.join(", ", EXPOSE_HEADERS));
      if ("OPTIONS".equalsIgnoreCase(request.getMethod())
          && request.getHeader("Access-Control-Request-Method") != null) {
        response.setStatus(HttpServletResponse.SC_NO_CONTENT);
        response.setHeader("Access-Control-Allow-Methods", String.join(", ", ALLOW_METHODS));
        response.setHeader("Access-Control-Allow-Headers", String.join(", ", ALLOW_HEADERS));
        return;
      }
    }
    filterChain.doFilter(request, response);
  }
}
