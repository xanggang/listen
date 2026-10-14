package com.worldtuner.client.shared;

import com.worldtuner.common.ApiError;
import com.worldtuner.common.QueryValidation;
import com.worldtuner.domain.stations.StationQuery;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;

/**
 * 电台列表查询参数解析：逐条复刻 Worker 版 stations.schema.ts 的行为、默认值与错误文案。
 */
public final class StationQueryParser {

  // 分页偏移上限；超过视为滥用请求。
  private static final int MAX_OFFSET = 100000;

  /** 工具类不需要实例化。 */
  private StationQueryParser() {
  }

  /**
   * 验证分页、筛选和关键词，限制页大小与深分页成本。
   *
   * @param request HTTP 请求，读取其查询参数
   * @return 已校验的查询参数
   */
  public static StationQuery parse(HttpServletRequest request) {
    Map<String, String[]> params = request.getParameterMap();
    QueryValidation.validateParams(params,
        "page", "pageSize", "languagesId", "tagsId", "countriesId", "keyword");
    int page = QueryValidation.integer(single(params, "page"), "page", 1, 10000);
    int pageSize = QueryValidation.integer(single(params, "pageSize"), "pageSize", 20, 100);
    int offset = (page - 1) * pageSize;
    if (offset > MAX_OFFSET) {
      throw new ApiError(400, "INVALID_PARAMETER", "Pagination offset exceeds 100000");
    }
    String keywordParam = single(params, "keyword");
    String keyword = keywordParam == null ? "" : keywordParam.trim();
    if (keyword.length() > 100) {
      throw new ApiError(400, "INVALID_PARAMETER", "keyword must be <= 100 characters");
    }
    return new StationQuery(
        page,
        pageSize,
        offset,
        keyword,
        optionalEntityId(params, "languagesId"),
        optionalEntityId(params, "tagsId"),
        optionalEntityId(params, "countriesId"));
  }

  /**
   * 读取可选的 19 位实体 ID 参数；未提供时返回 null。
   *
   * @param params 查询参数表
   * @param name   参数名
   * @return 校验通过的原值，或 null
   */
  private static String optionalEntityId(Map<String, String[]> params, String name) {
    String value = single(params, name);
    return value == null ? null : QueryValidation.entityId(value, name);
  }

  /**
   * 读取单值参数；重复参数已由 validateParams 拒绝，这里安全地取第一个值。
   *
   * @param params 查询参数表
   * @param name   参数名
   * @return 第一个值；缺失时为 null
   */
  private static String single(Map<String, String[]> params, String name) {
    String[] values = params.get(name);
    return values == null || values.length == 0 ? null : values[0];
  }
}
