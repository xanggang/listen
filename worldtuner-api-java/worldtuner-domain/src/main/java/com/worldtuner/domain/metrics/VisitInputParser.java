package com.worldtuner.domain.metrics;

import com.worldtuner.common.ApiError;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * 访问上报请求体解析：仅接受匿名 UUID、平台和固定页面名；拒绝额外字段以防误上传个人信息。
 * 行为与 Worker 版 metrics.schema.ts 的 parseVisitInput 一致。
 */
public final class VisitInputParser {

  // UUID v4 格式；版本位与变体位固定。
  private static final Pattern VISITOR_ID =
      Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
          Pattern.CASE_INSENSITIVE);

  // 请求体允许的字段集合；多余字段直接拒绝。
  private static final Set<String> ALLOWED_FIELDS = Set.of("visitorId", "source", "page");

  /** 工具类不需要实例化。 */
  private VisitInputParser() {
  }

  /**
   * 解析已反序列化的 JSON 对象。
   *
   * @param fields 请求体字段视图：字段名到字符串值的映射
   * @return 校验通过的输入
   * @throws ApiError 结构、字段、格式或口径不符时抛出 400 INVALID_METRIC
   */
  public static VisitInput parse(java.util.Map<String, String> fields) {
    if (fields == null || fields.size() != 3 || !ALLOWED_FIELDS.containsAll(fields.keySet())) {
      throw invalid();
    }
    String visitorId = fields.get("visitorId");
    String source = fields.get("source");
    String page = fields.get("page");
    if (visitorId == null || !VISITOR_ID.matcher(visitorId).matches()
        || source == null || !MetricPages.isAllowedSource(source)
        || page == null || !MetricPages.isAllowedPage(page)) {
      throw invalid();
    }
    return new VisitInput(visitorId, source, page);
  }

  /**
   * 统一的 400 错误；不区分具体失败原因，避免向客户端泄露校验细节。
   *
   * @return 业务异常
   */
  private static ApiError invalid() {
    return new ApiError(400, "INVALID_METRIC", "Invalid visit payload");
  }
}
