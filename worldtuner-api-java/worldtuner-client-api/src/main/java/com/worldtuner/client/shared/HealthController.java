package com.worldtuner.client.shared;

import com.worldtuner.common.ApiResult;
import com.worldtuner.common.QueryValidation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 健康检查接口：返回服务存活状态；不执行数据库探测，且拒绝无效查询参数。
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

  /**
   * 返回服务存活状态；service 名与 Worker 版保持一致，便于客户端探测逻辑复用。
   *
   * @param request HTTP 请求，用于查询参数校验
   * @return 统一包装的存活状态
   */
  @GetMapping
  public ApiResult<Map<String, String>> health(jakarta.servlet.http.HttpServletRequest request) {
    QueryValidation.validateParams(request.getParameterMap());
    return ApiResult.of(Map.of("status", "ok", "service", "worldtuner-api"));
  }
}
