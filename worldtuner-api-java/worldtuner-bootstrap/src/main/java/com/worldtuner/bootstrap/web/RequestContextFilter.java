package com.worldtuner.bootstrap.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 请求上下文过滤器：生成请求标识并设置公共安全响应头。
 * 行为与 Worker 版 middleware/context.ts 一致；默认 no-store 由具体路由按需覆盖。
 */
public class RequestContextFilter extends OncePerRequestFilter implements Ordered {

  /** 请求标识在请求属性中的键名；统一错误处理从这里读取。 */
  public static final String REQUEST_ID_ATTRIBUTE = "worldtuner.requestId";

  /**
   * 生成请求标识，设置 X-Request-Id、nosniff 与默认 no-store 头。
   *
   * @param request     HTTP 请求
   * @param response    HTTP 响应
   * @param filterChain 后续过滤器链
   */
  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String id = UUID.randomUUID().toString();
    request.setAttribute(REQUEST_ID_ATTRIBUTE, id);
    response.setHeader("X-Request-Id", id);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    filterChain.doFilter(request, response);
  }

  /**
   * 最先执行，保证所有响应都带上请求标识与安全头。
   *
   * @return 过滤器顺序
   */
  @Override
  public int getOrder() {
    return Ordered.HIGHEST_PRECEDENCE;
  }
}
