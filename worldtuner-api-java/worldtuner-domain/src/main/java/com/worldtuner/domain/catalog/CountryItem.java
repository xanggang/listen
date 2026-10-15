package com.worldtuner.domain.catalog;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 国家字典项：原始名称与中英文展示名分开返回，筛选 ID 保持不变。
 */
public class CountryItem {

  /**
   * 19 位十进制国家 ID，保持字符串原值。
   */
  private String id;

  /**
   * 国家名。
   */
  private String name;

  // 可空展示译名，客户端按当前语言回退原名。
  private String nameEn;
  private String nameZh;

  /**
   * 两位国家代码，如 CN、JP。
   */
  private String code;

  /**
   * 按公开电台关联统计的数量。
   */
  private long stationcount;

  /**
   * 创建空对象，供 MyBatis 反射填充字段。
   */
  public CountryItem() {
  }

  /**
   * 返回国家 ID。
   */
  public String getId() {
    return id;
  }

  /**
   * 设置国家 ID。
   */
  public void setId(String id) {
    this.id = id;
  }

  /**
   * 返回国家名。
   */
  public String getName() {
    return name;
  }

  /**
   * 设置国家名。
   */
  public void setName(String name) {
    this.name = name;
  }

  /**
   * 返回英文展示名，缺失时由客户端回退原名。
   */
  @JsonProperty("name_en")
  public String getNameEn() {
    return nameEn;
  }

  /**
   * 接收数据库中的英文展示名，允许为空。
   */
  public void setNameEn(String nameEn) {
    this.nameEn = nameEn;
  }

  /**
   * 返回中文展示名，缺失时由客户端回退英文与原名。
   */
  @JsonProperty("name_zh")
  public String getNameZh() {
    return nameZh;
  }

  /**
   * 接收数据库中的中文展示名，允许为空。
   */
  public void setNameZh(String nameZh) {
    this.nameZh = nameZh;
  }

  /**
   * 返回两位国家代码。
   */
  public String getCode() {
    return code;
  }

  /**
   * 设置两位国家代码。
   */
  public void setCode(String code) {
    this.code = code;
  }

  /**
   * 返回公开电台关联数量。
   */
  public long getStationcount() {
    return stationcount;
  }

  /**
   * 设置公开电台关联数量。
   */
  public void setStationcount(long stationcount) {
    this.stationcount = stationcount;
  }
}
