package com.worldtuner.common;

/**
 * 公开与管理接口统一成功响应包装：{"data": ...}，与 Worker 版 c.json({ data }) 一致。
 * 组件名 data 即 JSON 字段名，无需注解。
 *
 * @param <T> 业务数据类型
 * @param data 业务数据
 */
public record ApiResult<T>(T data) {

  /**
   * 创建包装结果。
   *
   * @param <T> 业务数据类型
   * @param data 业务数据
   * @return 包装结果
   */
  public static <T> ApiResult<T> of(T data) {
    return new ApiResult<>(data);
  }
}
