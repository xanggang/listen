package com.worldtuner.admin;

import com.worldtuner.common.ApiResult;
import com.worldtuner.common.QueryValidation;
import com.worldtuner.domain.admin.AdminStationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 管理端接口：存活探测与电台可见性上下架。
 * 本包内的接口由 bootstrap 的 AdminTokenFilter 统一鉴权，DTO 不与 client-api 复用。
 */
@RestController
@RequestMapping("/admin/api")
public class AdminController {

  private final AdminStationService stationService;

  /**
   * 注入管理端电台服务。
   *
   * @param stationService 管理端电台业务
   */
  public AdminController(AdminStationService stationService) {
    this.stationService = stationService;
  }

  /**
   * 返回管理端存活状态；与公开 API 的 health 分开，便于分别探活。
   *
   * @param request HTTP 请求，用于查询参数校验
   * @return 统一包装的存活状态
   */
  @GetMapping("/health")
  public ApiResult<Map<String, String>> health(HttpServletRequest request) {
    QueryValidation.validateParams(request.getParameterMap());
    return ApiResult.of(Map.of("status", "ok", "service", "worldtuner-admin-api"));
  }

  /**
   * 设置电台可见性：上架（visible）或下架（hidden）。
   *
   * @param id      19 位十进制电台 ID
   * @param request HTTP 请求，用于查询参数校验
   * @param body    JSON 请求体：{"visibility": "visible" | "hidden"}
   * @return 更新结果
   */
  @PutMapping("/stations/{id}/visibility")
  public ApiResult<Map<String, String>> setVisibility(@PathVariable("id") String id,
      HttpServletRequest request, @RequestBody Map<String, Object> body) {
    QueryValidation.validateParams(request.getParameterMap());
    String validatedId = QueryValidation.entityId(id, "id");
    Object value = body == null ? null : body.get("visibility");
    String visibility = stationService.setVisibility(validatedId,
        value instanceof String text ? text : null);
    return ApiResult.of(Map.of("id", validatedId, "visibility", visibility));
  }
}
