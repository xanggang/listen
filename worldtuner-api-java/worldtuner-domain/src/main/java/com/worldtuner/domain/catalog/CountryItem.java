package com.worldtuner.domain.catalog;

/**
 * 国家字典项：对外字段不含中英文译名，与 Worker 版契约保持一致。
 */
public class CountryItem {

  /** 19 位十进制国家 ID，保持字符串原值。 */
  private String id;

  /** 国家名。 */
  private String name;

  /** 两位国家代码，如 CN、JP。 */
  private String code;

  /** 按公开电台关联统计的数量。 */
  private long stationcount;

  /** 创建空对象，供 MyBatis 反射填充字段。 */
  public CountryItem() {
  }

  /** 返回国家 ID。 */
  public String getId() {
    return id;
  }

  /** 设置国家 ID。 */
  public void setId(String id) {
    this.id = id;
  }

  /** 返回国家名。 */
  public String getName() {
    return name;
  }

  /** 设置国家名。 */
  public void setName(String name) {
    this.name = name;
  }

  /** 返回两位国家代码。 */
  public String getCode() {
    return code;
  }

  /** 设置两位国家代码。 */
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
