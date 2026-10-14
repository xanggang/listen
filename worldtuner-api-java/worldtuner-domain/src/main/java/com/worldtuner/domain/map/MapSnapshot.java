package com.worldtuner.domain.map;

/**
 * 地图快照：包含 identity 与 gzip 两种编码的正文和内容 ETag。
 *
 * @param body      JSON 原始正文
 * @param gzip      gzip 压缩正文
 * @param etag      弱比较 ETag，形如 W/"<sha256hex>"
 * @param expiresAt 快照过期时间戳（毫秒）；TTL 从查询开始计时
 */
public record MapSnapshot(byte[] body, byte[] gzip, String etag, long expiresAt) {
}
