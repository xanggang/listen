package com.worldtuner.common;

/**
 * 业务异常：携带可公开的 HTTP 状态码与业务错误码，由统一异常处理转换为响应体。
 * 与 worldTuner-api（Worker 版）的 shared/errors.ts 语义一致。
 */
public class ApiError extends RuntimeException {

  /** HTTP 状态码，直接作为响应状态使用。 */
  private final int status;

  /** 业务错误码，例如 INVALID_PARAMETER、STATION_NOT_FOUND。 */
  private final String code;

  /**
   * 创建业务异常。
   *
   * @param status  HTTP 状态码，必须与客户端已知的错误语义一致
   * @param code    业务错误码，进入错误响应体的 error.code 字段
   * @param message 面向客户端的错误说明，进入 error.message 字段
   */
  public ApiError(int status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  /** 返回 HTTP 状态码。 */
  public int getStatus() {
    return status;
  }

  /** 返回业务错误码。 */
  public String getCode() {
    return code;
  }
}
