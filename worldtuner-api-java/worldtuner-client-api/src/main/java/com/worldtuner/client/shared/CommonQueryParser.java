package com.worldtuner.client.shared;

import com.worldtuner.common.QueryValidation;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;

/**
 * 字典与地图接口的通用查询参数解析：复刻 Worker 版 catalog.schema.ts 与 map.schema.ts 的行为。
 */
public final class CommonQueryParser {

  /** 工具类不需要实例化。 */
  private CommonQueryParser() {
  }

  /**
   * 验证字典列表参数；拒绝未知或重复参数，并限制最多返回 1000 项。
   *
   * @param request      HTTP 请求
   * @param defaultLimit 缺省 limit；语种 1000，国家 30
   * @return limit 值
   */
  public static int parseCatalogLimit(HttpServletRequest request, int defaultLimit) {
    QueryValidation.validateParams(request.getParameterMap(), "limit");
    return QueryValidation.integer(single(request.getParameterMap(), "limit"), "limit",
        defaultLimit, 1000);
  }

  /**
   * 验证标签搜索参数；保留 limit 契约，并限制关键词和翻页深度。
   *
   * @param request HTTP 请求
   * @return 标签查询参数
   */
  public static TagQuery parseTagQuery(HttpServletRequest request) {
    Map<String, String[]> params = request.getParameterMap();
    QueryValidation.validateParams(params, "limit", "q", "offset");
    String q = single(params, "q");
    String query = q == null ? "" : q.trim();
    if (query.length() > 100) {
      throw new com.worldtuner.common.ApiError(400, "INVALID_PARAMETER", "q must be <= 100 characters");
    }
    String rawOffset = single(params, "offset");
    int offset = 0;
    if (rawOffset != null) {
      if (!rawOffset.matches("^(0|[1-9]\\d*)$")) {
        throw new com.worldtuner.common.ApiError(400, "INVALID_PARAMETER",
            "offset must be a non-negative integer");
      }
      long parsed = Long.parseLong(rawOffset);
      if (parsed > 100000) {
        throw new com.worldtuner.common.ApiError(400, "INVALID_PARAMETER",
            "offset must be <= 100000");
      }
      offset = (int) parsed;
    }
    int limit = QueryValidation.integer(single(params, "limit"), "limit", 30, 1000);
    return new TagQuery(query, limit, offset);
  }

  /**
   * 验证地图点位游标与页大小，拒绝未知或重复参数。
   *
   * @param request HTTP 请求
   * @return 地图点位查询参数
   */
  public static MapQuery parseMapQuery(HttpServletRequest request) {
    Map<String, String[]> params = request.getParameterMap();
    QueryValidation.validateParams(params, "after", "limit");
    String after = single(params, "after");
    int limit = QueryValidation.integer(single(params, "limit"), "limit", 2000, 5000);
    return new MapQuery(after == null ? null : QueryValidation.entityId(after, "after"), limit);
  }

  /**
   * 读取单值参数。
   *
   * @param params 查询参数表
   * @param name   参数名
   * @return 第一个值；缺失时为 null
   */
  private static String single(Map<String, String[]> params, String name) {
    String[] values = params.get(name);
    return values == null || values.length == 0 ? null : values[0];
  }

  /**
   * 标签搜索查询参数。
   *
   * @param query  关键词（已去空白）
   * @param limit  最大返回条数
   * @param offset 翻页偏移量
   */
  public record TagQuery(String query, int limit, int offset) {
  }

  /**
   * 地图点位查询参数。
   *
   * @param after 游标 ID；第一页为 null
   * @param limit 页大小
   */
  public record MapQuery(String after, int limit) {
  }
}
