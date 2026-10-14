package com.worldtuner.client.shared;

import com.worldtuner.common.ApiResult;
import com.worldtuner.common.QueryValidation;
import com.worldtuner.domain.stations.StationPage;
import com.worldtuner.domain.stations.StationQuery;
import com.worldtuner.domain.stations.StationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 电台接口：列表与详情。响应结构与 Worker 版一致。
 * 参数校验发生在业务与缓存之前，错误响应不会被缓存。
 */
@RestController
@RequestMapping("/api/stations")
public class StationController {

  private final StationService service;

  /**
   * 注入电台服务。
   *
   * @param service 电台业务服务
   */
  public StationController(StationService service) {
    this.service = service;
  }

  /**
   * 使用验证后的参数调用电台服务并返回统一 JSON 包装。
   * 同时匹配带与不带结尾斜杠的路径，贴近 Worker 路由行为。
   *
   * @param request HTTP 请求，用于查询参数解析
   * @return 电台分页结果
   */
  @GetMapping({"", "/"})
  public ApiResult<StationPage> list(HttpServletRequest request) {
    StationQuery query = StationQueryParser.parse(request);
    return ApiResult.of(service.list(query));
  }

  /**
   * 读取电台详情；不存在时由服务层抛出统一异常。
   *
   * @param id      19 位十进制电台 ID
   * @param request HTTP 请求，用于拒绝详情接口不支持的查询参数
   * @return 电台详情
   */
  @GetMapping("/{id}")
  public ApiResult<?> detail(@PathVariable("id") String id, HttpServletRequest request) {
    QueryValidation.validateParams(request.getParameterMap());
    String validatedId = QueryValidation.entityId(id, "id");
    return ApiResult.of(service.detail(validatedId));
  }
}
