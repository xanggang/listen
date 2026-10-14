package com.worldtuner.domain.metrics;

/**
 * 一次页面访问的已校验输入。
 *
 * @param visitorId 浏览器本机生成的随机 UUID（v4），服务端不保存原值
 * @param source    来源平台：web / android
 * @param page      固定页面名，见 MetricPages
 */
public record VisitInput(String visitorId, String source, String page) {

  /** 重复访问在库内的去重标识：按日作用域哈希。 */
  private static final String HASH_PREFIX = "worldtuner-metrics-v1";

  /**
   * 计算作用域哈希：将高熵匿名 UUID 与日期结合哈希，避免保存原始标识或跨期关联标识。
   * 与 Worker 版 scopedHash 的输入格式保持一致，保证口径可合并。
   *
   * @param scope     作用域字符串，如 day:2026-10-09
   * @param visitorId 匿名 UUID
   * @return 64 位十六进制哈希
   */
  public static String scopedHash(String scope, String visitorId) {
    String input = HASH_PREFIX + ":" + scope + ":" + visitorId;
    try {
      byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
          .digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        hex.append(Character.forDigit((b >> 4) & 0xF, 16));
        hex.append(Character.forDigit(b & 0xF, 16));
      }
      return hex.toString();
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }
}
