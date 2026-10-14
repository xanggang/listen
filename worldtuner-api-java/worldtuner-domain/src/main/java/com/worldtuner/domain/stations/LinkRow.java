package com.worldtuner.domain.stations;

/**
 * 电台外链行对象：只暴露 id、平台与地址，不将来源身份或处理记录暴露给客户端。
 */
public class LinkRow {

  /** 19 位十进制外链 ID，保持字符串原值。 */
  private String id;

  /** 外链平台名。 */
  private String platform;

  /** 外链地址。 */
  private String url;

  /** 创建空对象，供 MyBatis 反射填充字段。 */
  public LinkRow() {
  }

  /** 返回外链 ID。 */
  public String getId() {
    return id;
  }

  /** 设置外链 ID。 */
  public void setId(String id) {
    this.id = id;
  }

  /** 返回外链平台名。 */
  public String getPlatform() {
    return platform;
  }

  /** 设置外链平台名。 */
  public void setPlatform(String platform) {
    this.platform = platform;
  }

  /** 返回外链地址。 */
  public String getUrl() {
    return url;
  }

  /** 设置外链地址。 */
  public void setUrl(String url) {
    this.url = url;
  }
}
