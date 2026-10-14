package com.worldtuner.domain.map;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

/**
 * 地图快照构建：序列化、坐标取整与 ETag 计算。
 * 语义与 Worker 版 map.snapshot.ts 的 buildSnapshot 一致：
 * 坐标固定为 [id, name, 经度, 纬度]，经纬度保留五位小数，ETag 为正文 SHA-256 的弱比较标签。
 */
public final class MapSnapshotBuilder {

  // 仅用于快照流式序列化；不参与其他响应的序列化配置。
  private static final JsonFactory JSON_FACTORY = new JsonFactory();

  /** 工具类不需要实例化。 */
  private MapSnapshotBuilder() {
  }

  /**
   * 构建完整快照：JSON 正文、gzip 正文与弱 ETag。
   *
   * @param rows      全量公开点位，必须已按 ID 排序
   * @param expiresAt 快照过期时间戳（毫秒）
   * @return 快照对象
   * @throws UncheckedIOException JSON 或 gzip 写入失败时抛出
   */
  public static MapSnapshot build(List<MapPoint> rows, long expiresAt) {
    String json = serialize(rows);
    byte[] body = json.getBytes(StandardCharsets.UTF_8);
    byte[] gzip = gzip(body);
    return new MapSnapshot(body, gzip, etag(body), expiresAt);
  }

  /**
   * 序列化点位为 {"data":{"count":N,"points":[[...]]}} 结构。
   * 坐标顺序固定为经度、纬度，与 GeoJSON 一致；整数值坐标按整数输出，与 JS Number 行为一致。
   *
   * @param rows 全量点位
   * @return JSON 文本
   */
  private static String serialize(List<MapPoint> rows) {
    ByteArrayOutputStream out = new ByteArrayOutputStream(1 << 20);
    try (JsonGenerator gen = JSON_FACTORY.createGenerator(out)) {
      gen.writeStartObject();
      gen.writeObjectFieldStart("data");
      gen.writeNumberField("count", rows.size());
      gen.writeArrayFieldStart("points");
      for (MapPoint row : rows) {
        gen.writeStartArray();
        gen.writeString(row.getId());
        gen.writeString(row.getName());
        // 坐标顺序固定为经度、纬度，与 GeoJSON 一致。
        writeCoordinate(gen, row.getGeoLong());
        writeCoordinate(gen, row.getGeoLat());
        gen.writeEndArray();
      }
      gen.writeEndArray();
      gen.writeEndObject();
      gen.writeEndObject();
    } catch (IOException e) {
      throw new UncheckedIOException("map snapshot serialization failed", e);
    }
    return out.toString(StandardCharsets.UTF_8);
  }

  /**
   * 写入单个坐标：保留五位小数（四舍五入），整数值去掉小数点，贴近 JS Number 序列化。
   *
   * @param gen       JSON 生成器
   * @param coordinate 原始坐标值
   * @throws IOException 写入失败时抛出
   */
  private static void writeCoordinate(JsonGenerator gen, Double coordinate) throws IOException {
    double value = BigDecimal.valueOf(coordinate).setScale(5, RoundingMode.HALF_UP).doubleValue();
    if (value == Math.rint(value) && !Double.isInfinite(value)) {
      gen.writeNumber((long) value);
    } else {
      gen.writeNumber(value);
    }
  }

  /**
   * 对正文做 gzip 压缩；客户端按 Content-Encoding 解码。
   *
   * @param body 原始正文
   * @return gzip 字节
   */
  private static byte[] gzip(byte[] body) {
    ByteArrayOutputStream out = new ByteArrayOutputStream(body.length / 4);
    try (java.util.zip.GZIPOutputStream gzip = new java.util.zip.GZIPOutputStream(out)) {
      gzip.write(body);
    } catch (IOException e) {
      throw new UncheckedIOException("map snapshot gzip failed", e);
    }
    return out.toByteArray();
  }

  /**
   * 计算正文 SHA-256 并生成弱 ETag；identity 与 gzip 两种编码共用内容版本。
   *
   * @param body 原始正文
   * @return 形如 W/"<hex>" 的 ETag
   */
  private static String etag(byte[] body) {
    MessageDigest digest;
    try {
      digest = MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
    StringBuilder hex = new StringBuilder(digest.digest(body).length * 2);
    for (byte b : digest.digest(body)) {
      hex.append(Character.forDigit((b >> 4) & 0xF, 16));
      hex.append(Character.forDigit(b & 0xF, 16));
    }
    return "W/\"" + hex + "\"";
  }
}
