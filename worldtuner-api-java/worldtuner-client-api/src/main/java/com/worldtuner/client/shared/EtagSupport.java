package com.worldtuner.client.shared;

/**
 * HTTP 协商工具：gzip 内容协商与 ETag 弱比较。
 * 行为与 Worker 版 middleware/map-snapshot.ts 一致。
 */
public final class EtagSupport {

  /** 工具类不需要实例化。 */
  private EtagSupport() {
  }

  /**
   * 按 Accept-Encoding 的质量权重决定是否提供 gzip；显式 q=0 优先于通配符。
   * 与 TS 实现一致：优先取 gzip 的权重，未声明 gzip 时回退到 *，两者都未声明视为不支持。
   *
   * @param acceptEncoding 请求头原值，可为 null
   * @return 客户端接受 gzip 时返回 true
   */
  public static boolean acceptsGzip(String acceptEncoding) {
    Double gzipWeight = null;
    Double wildcardWeight = null;
    if (acceptEncoding != null) {
      for (String item : acceptEncoding.split(",")) {
        String[] parts = item.trim().toLowerCase(java.util.Locale.ROOT).split(";");
        String encoding = parts[0].trim();
        double quality = 1;
        for (int i = 1; i < parts.length; i++) {
          String param = parts[i].trim();
          // 只读取 q 参数，其余扩展参数不参与编码选择。
          if (param.startsWith("q=")) {
            quality = parseQuality(param.substring(2));
          }
        }
        if ("gzip".equals(encoding)) {
          gzipWeight = quality;
        } else if ("*".equals(encoding)) {
          wildcardWeight = quality;
        }
      }
    }
    double chosen = gzipWeight != null ? gzipWeight
        : wildcardWeight != null ? wildcardWeight
        : 0;
    return chosen > 0;
  }

  /**
   * 解析 q 值；非法值按 0 处理，贴近 Number 解析失败时的保守行为。
   *
   * @param value q 参数文本
   * @return 质量权重
   */
  private static double parseQuality(String value) {
    try {
      return Double.parseDouble(value.trim());
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  /**
   * GET 的 If-None-Match 使用弱比较，并支持多个标签和通配符。
   *
   * @param ifNoneMatch 请求头原值，可为 null
   * @param etag        当前资源的 ETag
   * @return 匹配时返回 true（可返回 304）
   */
  public static boolean matchesEtag(String ifNoneMatch, String etag) {
    if (ifNoneMatch == null) {
      return false;
    }
    for (String item : ifNoneMatch.split(",")) {
      String candidate = item.trim();
      if (candidate.equals("*") || stripWeak(candidate).equals(stripWeak(etag))) {
        return true;
      }
    }
    return false;
  }

  /**
   * 去掉弱比较前缀 W/，编码不同但语义相同的正文可以共享校验结果。
   *
   * @param etag ETag 文本
   * @return 无弱前缀的标签值
   */
  private static String stripWeak(String etag) {
    return etag.startsWith("W/") ? etag.substring(2) : etag;
  }
}
