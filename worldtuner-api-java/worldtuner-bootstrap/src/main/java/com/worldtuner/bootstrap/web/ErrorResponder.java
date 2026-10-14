package com.worldtuner.bootstrap.web;

import com.worldtuner.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 统一错误响应写出：业务异常与过滤器内异常共用同一响应结构和请求标识。
 * 响应结构与 Worker 版 middleware/errors.ts 一致。
 */
@Component
public class ErrorResponder {

  private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

  /**
   * 注入 JSON 序列化器。
   *
   * @param objectMapper 共享 JSON 解析器
   */
  public ErrorResponder(com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  /**
   * 写出统一错误响应；429 附加 Retry-After。
   *
   * @param request  HTTP 请求，用于读取请求标识
   * @param response HTTP 响应
   * @param error    业务异常
   * @throws IOException 写出失败时抛出
   */
  public void write(HttpServletRequest request, HttpServletResponse response, ApiError error)
      throws IOException {
    if (error.getStatus() == 429) {
      response.setHeader("Retry-After", "60");
    }
    write(request, response, error.getStatus(), error.getCode(), error.getMessage());
  }

  /**
   * 写出统一错误响应体：{"error":{"code","message","requestId"}}。
   *
   * @param request  HTTP 请求
   * @param response HTTP 响应
   * @param status   HTTP 状态码
   * @param code     业务错误码
   * @param message  面向客户端的错误说明
   * @throws IOException 写出失败时抛出
   */
  public void write(HttpServletRequest request, HttpServletResponse response, int status,
      String code, String message) throws IOException {
    response.setStatus(status);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.setContentType("application/json");
    String requestId = request.getAttribute(RequestContextFilter.REQUEST_ID_ATTRIBUTE) == null
        ? null
        : String.valueOf(request.getAttribute(RequestContextFilter.REQUEST_ID_ATTRIBUTE));
    var body = java.util.Map.of(
        "error", java.util.Map.of(
            "code", code,
            "message", message,
            "requestId", requestId == null ? "" : requestId));
    response.getWriter().write(objectMapper.writeValueAsString(body));
  }

  /**
   * 写出兜底的内部错误；内部异常不在响应中泄露细节。
   *
   * @param request  HTTP 请求
   * @param response HTTP 响应
   * @param cause    内部异常，仅在服务端日志记录
   * @throws IOException 写出失败时抛出
   */
  public void writeInternal(HttpServletRequest request, HttpServletResponse response,
      Exception cause) throws IOException {
    org.slf4j.LoggerFactory.getLogger(ErrorResponder.class).error(
        "api_error request={} message={}",
        request.getAttribute(RequestContextFilter.REQUEST_ID_ATTRIBUTE), cause.getMessage(), cause);
    write(request, response, 500, "INTERNAL_ERROR", "Service temporarily unavailable");
  }
}
