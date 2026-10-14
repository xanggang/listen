package com.worldtuner.domain.catalog;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 标签字典项：同时作为查询行对象和对外 DTO。
 * 对外字段名与 Worker 版契约一致：name_en / name_zh 为下划线风格，stationcount 为全小写。
 */
public class TagItem {

  /** 19 位十进制标签 ID，保持字符串原值。 */
  private String id;

  /** 标签原名，用于原始匹配。 */
  private String name;

  /** 英文展示名，可能为 null。 */
  private String nameEn;

  /** 中文展示名，可能为 null。 */
  private String nameZh;

  /** 按公开电台关联统计的数量。 */
  private long stationcount;

  /** 创建空对象，供 MyBatis 反射填充字段。 */
  public TagItem() {
  }

  /** 返回标签 ID。 */
  public String getId() {
    return id;
  }

  /** 设置标签 ID。 */
  public void setId(String id) {
    this.id = id;
  }

  /** 返回标签原名。 */
  public String getName() {
    return name;
  }

  /** 设置标签原名。 */
  public void setName(String name) {
    this.name = name;
  }

  /** 返回英文展示名。 */
  @JsonProperty("name_en")
  public String getNameEn() {
    return nameEn;
  }

  /** 设置英文展示名。 */
  public void setNameEn(String nameEn) {
    this.nameEn = nameEn;
  }

  /** 返回中文展示名。 */
  @JsonProperty("name_zh")
  public String getNameZh() {
    return nameZh;
  }

  /** 设置中文展示名。 */
  public void setNameZh(String nameZh) {
    this.nameZh = nameZh;
  }

  /** 返回公开电台关联数量。 */
  public long getStationcount() {
    return stationcount;
  }

  /** 设置公开电台关联数量。 */
  public void setStationcount(long stationcount) {
    this.stationcount = stationcount;
  }
}
