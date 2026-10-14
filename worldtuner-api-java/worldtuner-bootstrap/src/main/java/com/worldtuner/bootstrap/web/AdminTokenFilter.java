package com.worldtuner.bootstrap.web;

import com.worldtuner.common.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 管理端 Token 鉴权过滤器：保护 /admin/api/** 全部接口。
 * 过渡期使用静态 Token；接入真实用户体系后替换为完整的鉴权方案。
 */
public class AdminTokenFilter extends OncePerRequestFilter {

  private final String token;

  private final ErrorResponder responder;

  /**
   * 注入静态 Token 与错误写出器。
   *
   * @param token     配置的管理端 Token
   * @param responder 错误响应写出器
   */
  public AdminTokenFilter(String token, ErrorResponder responder) {
    this.token = token;
    this.responder = responder;
  }

  /**
   * 仅管理端路径需要鉴权。
   *
   * @param request HTTP 请求
   * @return 非管理端路径返回 true（跳过过滤）
   */
  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/admin/api");
  }

  /**
   * 校验 Authorization: Bearer &lt;token&gt;；缺失或不匹配返回 401。
   *
   * @param request     HTTP 请求
   * @param response    HTTP 响应
   * @param filterChain 后续过滤器链
   */
  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String header = request.getHeader("Authorization");
    String presented = header != null && header.startsWith("Bearer ")
        ? header.substring("Bearer ".length()).trim()
        : null;
    if (presented == null || !constantTimeEquals(presented, token)) {
      responder.write(request, response,
          new ApiError(401, "UNAUTHORIZED", "Admin token required"));
      return;
    }
    filterChain.doFilter(request, response);
  }

  /**
   * 常量时间比较，避免 Token 比较被计时侧信道逐字符猜测。
   *
   * @param presented 请求携带的 Token
   * @param expected  配置的 Token
   * @return 一致返回 true
   */
  private boolean constantTimeEquals(String presented, String expected) {
    return java.security.MessageDigest.isEqual(
        presented.getBytes(java.nio.charset.StandardCharsets.UTF_8),
        expected.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }
}
