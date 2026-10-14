package com.worldtuner.domain.stations;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 播放流行对象，同时承担对外 DTO 职责；字段名与 Worker 版 streamDto 输出一致。
 */
public class StreamRow {

  /** 19 位十进制播放流 ID，保持字符串原值。 */
  private String id;

  /** 原始流地址。 */
  private String url;

  /** 重定向解析后的地址，可能为 null。 */
  private String urlResolved;

  /** 编码格式，可能为 null。 */
  private String codec;

  /** 比特率，可能为 null。 */
  private Integer bitrate;

  /** 是否 HLS 流：0 / 1 / null（未知）。 */
  private Integer hls;

  /** 是否首选流。 */
  private boolean isPrimary;

  /** 最近检查结果：0 / 1 / null（未知）。 */
  private Integer lastcheckok;

  /** 最近检查时间，可能为 null。 */
  private String lastCheckedAt;

  /** 解析时间，可能为 null。 */
  private String resolvedAt;

  /** 创建空对象，供 MyBatis 反射填充字段。 */
  public StreamRow() {
  }

  /** 返回播放流 ID。 */
  public String getId() {
    return id;
  }

  /** 设置播放流 ID。 */
  public void setId(String id) {
    this.id = id;
  }

  /** 返回原始流地址。 */
  public String getUrl() {
    return url;
  }

  /** 设置原始流地址。 */
  public void setUrl(String url) {
    this.url = url;
  }

  /** 返回解析后的地址。 */
  public String getUrlResolved() {
    return urlResolved;
  }

  /** 设置解析后的地址。 */
  public void setUrlResolved(String urlResolved) {
    this.urlResolved = urlResolved;
  }

  /** 返回编码格式。 */
  public String getCodec() {
    return codec;
  }

  /** 设置编码格式。 */
  public void setCodec(String codec) {
    this.codec = codec;
  }

  /** 返回比特率。 */
  public Integer getBitrate() {
    return bitrate;
  }

  /** 设置比特率。 */
  public void setBitrate(Integer bitrate) {
    this.bitrate = bitrate;
  }

  /** 返回是否 HLS 流。 */
  public Integer getHls() {
    return hls;
  }

  /** 设置是否 HLS 流。 */
  public void setHls(Integer hls) {
    this.hls = hls;
  }

  /** 返回是否首选流；JSON 字段名固定为 isPrimary，避免 Jackson 推断成 primary。 */
  @JsonProperty("isPrimary")
  public boolean isPrimary() {
    return isPrimary;
  }

  /** 设置是否首选流。 */
  public void setPrimary(boolean primary) {
    this.isPrimary = primary;
  }

  /** 返回最近检查结果。 */
  public Integer getLastcheckok() {
    return lastcheckok;
  }

  /** 设置最近检查结果。 */
  public void setLastcheckok(Integer lastcheckok) {
    this.lastcheckok = lastcheckok;
  }

  /** 返回最近检查时间。 */
  public String getLastCheckedAt() {
    return lastCheckedAt;
  }

  /** 设置最近检查时间。 */
  public void setLastCheckedAt(String lastCheckedAt) {
    this.lastCheckedAt = lastCheckedAt;
  }

  /** 返回解析时间。 */
  public String getResolvedAt() {
    return resolvedAt;
  }

  /** 设置解析时间。 */
  public void setResolvedAt(String resolvedAt) {
    this.resolvedAt = resolvedAt;
  }
}
