package com.worldtuner.domain.catalog;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 语种字典项：同时作为查询行对象和对外 DTO，字段比标签多一个语言代码。
 */
public class LanguageItem {

  /** 19 位十进制语种 ID，保持字符串原值。 */
  private String id;

  /** 语种原名。 */
  private String name;

  /** 英文展示名，可能为 null。 */
  private String nameEn;

  /** 中文展示名，可能为 null。 */
  private String nameZh;

  /** 语言代码，可能为 null（无代码的语种）。 */
  private String code;

  /** 按公开电台关联统计的数量。 */
  private long stationcount;

  /** 创建空对象，供 MyBatis 反射填充字段。 */
  public LanguageItem() {
  }

  /** 返回语种 ID。 */
  public String getId() {
    return id;
  }

  /** 设置语种 ID。 */
  public void setId(String id) {
    this.id = id;
  }

  /** 返回语种原名。 */
  public String getName() {
    return name;
  }

  /** 设置语种原名。 */
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

  /** 返回语言代码。 */
  public String getCode() {
    return code;
  }

  /** 设置语言代码。 */
  public void setCode(String code) {
    this.code = code;
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
