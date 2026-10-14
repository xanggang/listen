package com.worldtuner.bootstrap.web;

import com.worldtuner.bootstrap.DataSourceConfig.WorldTunerProps;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;

/**
 * 过滤器注册：统一控制执行顺序。
 * 顺序为 请求上下文 → 兜底异常 → CORS → 限流 → 管理 Token → JSON 缓存。
 * 每个过滤器独立注册为 Bean，保证 Servlet 容器与 MockMvc 都能按序装配。
 */
@Configuration
public class WebFilterConfig {

  /** 请求上下文过滤器的注册顺序。 */
  private static final int ORDER_CONTEXT = 10;

  /** 兜底异常过滤器的注册顺序。 */
  private static final int ORDER_CATCH = 20;

  /** CORS 过滤器的注册顺序。 */
  private static final int ORDER_CORS = 30;

  /** 限流过滤器的注册顺序。 */
  private static final int ORDER_RATE_LIMIT = 40;

  /** 管理 Token 过滤器的注册顺序。 */
  private static final int ORDER_ADMIN = 50;

  /** JSON 缓存过滤器的注册顺序。 */
  private static final int ORDER_CACHE = 60;

  /**
   * 注册请求上下文过滤器；最先执行保证所有响应带请求标识与安全头。
   *
   * @return 过滤器注册
   */
  @Bean
  public FilterRegistrationBean<RequestContextFilter> requestContextFilterRegistration() {
    FilterRegistrationBean<RequestContextFilter> registration =
        new FilterRegistrationBean<>(new RequestContextFilter());
    registration.setOrder(ORDER_CONTEXT);
    return registration;
  }

  /**
   * 注册兜底异常过滤器；在业务过滤器外侧捕获过滤器链中的 ApiError。
   *
   * @param responder 统一错误写出器
   * @return 过滤器注册
   */
  @Bean
  public FilterRegistrationBean<ApiErrorCatchFilter> apiErrorCatchFilterRegistration(
      ErrorResponder responder) {
    FilterRegistrationBean<ApiErrorCatchFilter> registration =
        new FilterRegistrationBean<>(new ApiErrorCatchFilter(responder));
    registration.setOrder(ORDER_CATCH);
    return registration;
  }

  /**
   * 注册 CORS 过滤器；白名单来自应用配置。
   *
   * @param props 应用配置
   * @return 过滤器注册
   */
  @Bean
  public FilterRegistrationBean<CorsFilter> corsFilterRegistration(WorldTunerProps props) {
    CorsFilter filter = new CorsFilter(Arrays.stream(props.allowedOrigins().split(","))
        .map(String::trim).filter(origin -> !origin.isEmpty()).toList());
    FilterRegistrationBean<CorsFilter> registration = new FilterRegistrationBean<>(filter);
    registration.setOrder(ORDER_CORS);
    return registration;
  }

  /**
   * 注册限流过滤器；阈值来自应用配置。
   *
   * @param props   应用配置
   * @param limiter 进程内限流器
   * @return 过滤器注册
   */
  @Bean
  public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(
      WorldTunerProps props, RateLimiter limiter) {
    RateLimitFilter filter = new RateLimitFilter(limiter, props.readLimitPerMinute(),
        props.searchLimitPerMinute(), props.metricsLimitPerMinute());
    FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(filter);
    registration.setOrder(ORDER_RATE_LIMIT);
    return registration;
  }

  /**
   * 注册管理端 Token 过滤器。
   *
   * @param props     应用配置
   * @param responder 统一错误写出器
   * @return 过滤器注册
   */
  @Bean
  public FilterRegistrationBean<AdminTokenFilter> adminTokenFilterRegistration(
      WorldTunerProps props, ErrorResponder responder) {
    FilterRegistrationBean<AdminTokenFilter> registration =
        new FilterRegistrationBean<>(new AdminTokenFilter(props.adminToken(), responder));
    registration.setOrder(ORDER_ADMIN);
    return registration;
  }

  /**
   * 注册 JSON 缓存过滤器；可由配置关闭。
   *
   * @param props 应用配置
   * @return 过滤器注册
   */
  @Bean
  public FilterRegistrationBean<JsonCacheFilter> jsonCacheFilterRegistration(
      WorldTunerProps props) {
    FilterRegistrationBean<JsonCacheFilter> registration =
        new FilterRegistrationBean<>(new JsonCacheFilter(props.cacheEnabled()));
    registration.setOrder(ORDER_CACHE);
    return registration;
  }
}
