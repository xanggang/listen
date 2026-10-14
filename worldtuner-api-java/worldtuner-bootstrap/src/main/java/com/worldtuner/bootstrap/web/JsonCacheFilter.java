package com.worldtuner.bootstrap.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 公开 JSON 接口的进程内响应缓存：对齐 Worker 版 Cache API 的行为。
 * 只缓存 200 的 JSON 响应；缓存键包含完整查询串，因此非法参数的 URL
 * 不会命中缓存（其错误响应从未被缓存）。缓存命中时响应头仍走默认值（no-store），
 * 与 Worker 版 cacheResponse 返回 c.json 的行为一致。
 */
public class JsonCacheFilter extends OncePerRequestFilter {

  /** 缓存条目：正文、内容类型与过期时间戳。 */
  private record CacheEntry(byte[] body, String contentType, String characterEncoding,
      long expiresAt) {
  }

  /** 缓存上限（条目数）：目录规模下足够，超出后整体清空重启积累。 */
  private static final int MAX_ENTRIES = 10_000;

  private final Map<String, CacheEntry> store = new ConcurrentHashMap<>();

  private final boolean enabled;

  /**
   * 注入缓存开关。
   *
   * @param enabled 是否启用进程内缓存
   */
  public JsonCacheFilter(boolean enabled) {
    this.enabled = enabled;
  }

  /**
   * 未启用缓存时直接放行。
   *
   * @param request HTTP 请求
   * @return 禁用缓存时返回 true
   */
  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !enabled || ttlFor(request) <= 0;
  }

  /**
   * 计算请求的缓存 TTL（秒）；0 表示不缓存。
   *
   * @param request HTTP 请求
   * @return TTL 秒数
   */
  private int ttlFor(HttpServletRequest request) {
    String uri = request.getRequestURI();
    boolean get = "GET".equalsIgnoreCase(request.getMethod());
    if (!get) {
      return 0;
    }
    if (uri.equals("/api/languages") || uri.equals("/api/tags") || uri.equals("/api/countries")) {
      return 3600;
    }
    if (uri.equals("/api/stations")) {
      // 关键词搜索不使用公共缓存，普通列表缓存五分钟。
      String keyword = request.getParameter("keyword");
      return keyword == null || keyword.isBlank() ? 300 : 0;
    }
    if (uri.startsWith("/api/stations/")) {
      return 300;
    }
    if (uri.equals("/api/map/stations")) {
      return 300;
    }
    return 0;
  }

  /**
   * 命中缓存直接返回正文；未命中则执行业务并仅缓存成功响应。
   *
   * @param request     HTTP 请求
   * @param response    HTTP 响应
   * @param filterChain 后续过滤器链
   */
  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String key = request.getRequestURI() + "?" + sortedQuery(request);
    CacheEntry cached = store.get(key);
    if (cached != null && cached.expiresAt() > System.currentTimeMillis()) {
      response.setStatus(HttpServletResponse.SC_OK);
      response.setContentType(cached.contentType());
      if (cached.characterEncoding() != null) {
        response.setCharacterEncoding(cached.characterEncoding());
      }
      response.setContentLength(cached.body().length);
      response.getOutputStream().write(cached.body());
      return;
    }
    if (cached != null) {
      store.remove(key);
    }
    // Spring 提供的缓存包装器：捕获正文后再真正写回客户端。
    org.springframework.web.util.ContentCachingResponseWrapper wrapper =
        new org.springframework.web.util.ContentCachingResponseWrapper(response);
    filterChain.doFilter(request, wrapper);
    byte[] body = wrapper.getContentAsByteArray();
    if (wrapper.getStatus() == HttpServletResponse.SC_OK && body.length > 0
        && store.size() < MAX_ENTRIES) {
      store.put(key, new CacheEntry(body, wrapper.getContentType(),
          wrapper.getCharacterEncoding(), System.currentTimeMillis() + ttlFor(request) * 1000L));
    }
    wrapper.copyBodyToResponse();
  }

  /**
   * 将查询参数按名称排序后拼接，提升缓存键稳定性。
   *
   * @param request HTTP 请求
   * @return 排序后的查询串
   */
  private String sortedQuery(HttpServletRequest request) {
    Map<String, String[]> params = request.getParameterMap();
    if (params.isEmpty()) {
      return "";
    }
    TreeMap<String, String> sorted = new TreeMap<>();
    params.forEach((name, values) -> sorted.put(name, values == null ? "" : String.join(",", values)));
    StringBuilder builder = new StringBuilder();
    sorted.forEach((name, value) -> {
      if (builder.length() > 0) {
        builder.append('&');
      }
      builder.append(name).append('=').append(value);
    });
    return builder.toString();
  }
}
