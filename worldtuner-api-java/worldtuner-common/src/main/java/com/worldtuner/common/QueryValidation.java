package com.worldtuner.common;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 请求参数校验工具：逐条复刻 worldTuner-api（Worker 版）shared/validation.ts 的行为与错误文案，
 * 保证两个服务对非法输入返回完全一致的 400 响应。
 */
public final class QueryValidation {

  // 正整数（不含 0 与前导零）；与 TS 版 /^[1-9]\d*$/ 一致。
  private static final Pattern POSITIVE_INTEGER = Pattern.compile("^[1-9]\\d*$");

  // 19 位十进制实体 ID；必须保持字符串原值，禁止经数值类型转换以免丢失前导零。
  private static final Pattern ENTITY_ID = Pattern.compile("^\\d{19}$");

  /** 工具类不需要实例化。 */
  private QueryValidation() {
  }

  /**
   * 拒绝未声明或重复的查询参数，避免不同组件对同一参数产生不一致解释。
   *
   * @param params  已解析的查询参数表
   * @param allowed 本接口允许出现的参数名
   * @throws ApiError 出现未知参数或同名字段出现多次时抛出 400 INVALID_PARAMETER
   */
  public static void validateParams(Map<String, String[]> params, String... allowed) {
    for (Map.Entry<String, String[]> entry : params.entrySet()) {
      boolean repeated = entry.getValue() != null && entry.getValue().length != 1;
      if (repeated || !contains(allowed, entry.getKey())) {
        throw new ApiError(400, "INVALID_PARAMETER", "Unknown or repeated parameter: " + entry.getKey());
      }
    }
  }

  /**
   * 解析安全的正整数；仅在参数缺失时使用默认值，非法值抛出 400。
   *
   * @param value    原始参数值，可为 null 表示缺失
   * @param name     参数名，用于错误文案
   * @param fallback 缺失时的默认值；null 表示该参数必填
   * @param max      允许的最大值，超出即拒绝
   * @return 解析后的正整数
   */
  public static int integer(String value, String name, Integer fallback, int max) {
    if (value == null && fallback != null) {
      return fallback;
    }
    if (value == null || value.isEmpty() || !POSITIVE_INTEGER.matcher(value).matches()) {
      throw new ApiError(400, "INVALID_PARAMETER", name + " must be a positive integer");
    }
    long parsed = Long.parseLong(value);
    if (parsed > max) {
      throw new ApiError(400, "INVALID_PARAMETER", name + " must be <= " + max);
    }
    return (int) parsed;
  }

  /**
   * 验证 19 位十进制实体 ID，保持字符串原值及前导零。
   *
   * @param value 原始参数值
   * @param name  参数名，用于错误文案
   * @return 校验通过的原值
   */
  public static String entityId(String value, String name) {
    if (value != null && ENTITY_ID.matcher(value).matches()) {
      return value;
    }
    throw new ApiError(400, "INVALID_PARAMETER", name + " must be a 19-digit entity ID");
  }

  /**
   * 判断数组中是否包含目标元素，避免为一次性判断引入额外依赖。
   */
  private static boolean contains(String[] values, String target) {
    for (String value : values) {
      if (value.equals(target)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 将用户文本转换为字面 LIKE 模式，转义反斜杠、百分号与下划线，避免通配符改变搜索范围。
   *
   * @param value 用户输入的关键词
   * @return 已转义并包裹百分号的 LIKE 模式
   */
  public static String containsPattern(String value) {
    String escaped = value.replaceAll("[\\\\%_]", "\\\\$0");
    return "%" + escaped + "%";
  }

  /**
   * 归一化来源标识：全部转小写，便于大小写不敏感的比较（如 Content-Type 检查）。
   *
   * @param value 原始字符串，可为 null
   * @return 小写形式；null 输入返回 null
   */
  public static String lowerCase(String value) {
    return value == null ? null : value.toLowerCase(Locale.ROOT);
  }
}
