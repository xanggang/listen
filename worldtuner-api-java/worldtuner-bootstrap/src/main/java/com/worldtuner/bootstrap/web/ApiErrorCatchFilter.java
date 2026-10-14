package com.worldtuner.bootstrap.web;

import com.worldtuner.common.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 兜底异常过滤器：过滤器链内抛出的业务异常在此转换为统一错误响应。
 * Controller 内的异常由 GlobalExceptionHandler 处理；两处共用同一响应结构。
 */
@Component
public class ApiErrorCatchFilter extends OncePerRequestFilter {

  private final ErrorResponder responder;

  /**
   * 注入统一错误写出器。
   *
   * @param responder 错误响应写出器
   */
  public ApiErrorCatchFilter(ErrorResponder responder) {
    this.responder = responder;
  }

  /**
   * 捕获过滤器链中的业务异常；未知异常按内部错误兜底。
   *
   * @param request     HTTP 请求
   * @param response    HTTP 响应
   * @param filterChain 后续过滤器链
   */
  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    try {
      filterChain.doFilter(request, response);
    } catch (ApiError error) {
      responder.write(request, response, error);
    } catch (Exception cause) {
      responder.writeInternal(request, response, cause);
    }
  }
}
