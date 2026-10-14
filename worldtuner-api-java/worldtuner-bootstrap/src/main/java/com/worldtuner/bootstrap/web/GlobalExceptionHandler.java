package com.worldtuner.bootstrap.web;

import com.worldtuner.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

/**
 * 统一异常处理：将业务异常与框架异常转换为与 Worker 版一致的 HTTP 错误响应。
 * 只在服务端日志记录内部异常，不向客户端泄露细节。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private final ErrorResponder responder;

  /**
   * 注入统一错误写出器，复用响应结构。
   *
   * @param responder 错误响应写出器
   */
  public GlobalExceptionHandler(ErrorResponder responder) {
    this.responder = responder;
  }

  /**
   * 业务异常：携带可公开的状态码与业务错误码；429 附加 Retry-After。
   *
   * @param error   业务异常
   * @param request HTTP 请求
   * @return 错误响应
   */
  @ExceptionHandler(ApiError.class)
  public ResponseEntity<Object> handleApiError(ApiError error, HttpServletRequest request) {
    HttpHeaders headers = new HttpHeaders();
    if (error.getStatus() == 429) {
      headers.set("Retry-After", "60");
    }
    return ResponseEntity.status(error.getStatus()).headers(headers)
        .body(errorBody(request, error.getCode(), error.getMessage()));
  }

  /**
   * 未注册路径：返回 404，与 Worker 版 notFound 行为一致。
   *
   * @param exception 框架异常
   * @param request   HTTP 请求
   * @return 错误响应
   */
  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<Object> handleNotFound(NoResourceFoundException exception,
      HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(errorBody(request, "NOT_FOUND", "Endpoint not found"));
  }

  /**
   * 统计入口之外的写入方法返回 405，并固定 Allow 头。
   *
   * @param exception 框架异常
   * @param request   HTTP 请求
   * @return 错误响应
   */
  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<Object> handleMethodNotSupported(
      HttpRequestMethodNotSupportedException exception, HttpServletRequest request) {
    HttpHeaders headers = new HttpHeaders();
    headers.set(HttpHeaders.ALLOW, "GET, HEAD, OPTIONS");
    return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).headers(headers)
        .body(errorBody(request, "METHOD_NOT_ALLOWED", "This method is not supported"));
  }

  /**
   * 请求体缺失或不可读：管理端写接口的兜底校验错误。
   *
   * @param exception 框架异常
   * @param request   HTTP 请求
   * @return 错误响应
   */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<Object> handleUnreadable(HttpMessageNotReadableException exception,
      HttpServletRequest request) {
    return ResponseEntity.badRequest()
        .body(errorBody(request, "INVALID_PARAMETER", "JSON body required"));
  }

  /**
   * 兜底：未知异常按内部错误处理，仅在服务端日志记录。
   *
   * @param cause   未知异常
   * @param request HTTP 请求
   * @return 错误响应
   */
  @ExceptionHandler(Exception.class)
  public ResponseEntity<Object> handleInternal(Exception cause, HttpServletRequest request) {
    org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class).error(
        "api_error request={} message={}",
        request.getAttribute(RequestContextFilter.REQUEST_ID_ATTRIBUTE), cause.getMessage(), cause);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(errorBody(request, "INTERNAL_ERROR", "Service temporarily unavailable"));
  }

  /**
   * 构建统一错误响应体：{"error":{"code","message","requestId"}}。
   *
   * @param request HTTP 请求
   * @param code    业务错误码
   * @param message 错误说明
   * @return 响应体
   */
  private Object errorBody(HttpServletRequest request, String code, String message) {
    Object attribute = request.getAttribute(RequestContextFilter.REQUEST_ID_ATTRIBUTE);
    String requestId = attribute == null ? "" : String.valueOf(attribute);
    return Map.of("error", Map.of("code", code, "message", message, "requestId", requestId));
  }
}
