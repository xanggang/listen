package com.worldtuner.domain.map;

/**
 * 地图点位轻量行对象，同时承担对外 DTO 职责。
 * 字段名与 Worker 版 map/stations 响应一致（geoLat / geoLong 驼峰）。
 */
public class MapPoint {

  /** 19 位十进制电台 ID，保持字符串原值。 */
  private String id;

  /** 电台名称。 */
  private String name;

  /** 纬度。 */
  private Double geoLat;

  /** 经度。 */
  private Double geoLong;

  /** 创建空对象，供 MyBatis 反射填充字段。 */
  public MapPoint() {
  }

  /** 返回电台 ID。 */
  public String getId() {
    return id;
  }

  /** 设置电台 ID。 */
  public void setId(String id) {
    this.id = id;
  }

  /** 返回电台名称。 */
  public String getName() {
    return name;
  }

  /** 设置电台名称。 */
  public void setName(String name) {
    this.name = name;
  }

  /** 返回纬度。 */
  public Double getGeoLat() {
    return geoLat;
  }

  /** 设置纬度。 */
  public void setGeoLat(Double geoLat) {
    this.geoLat = geoLat;
  }

  /** 返回经度。 */
  public Double getGeoLong() {
    return geoLong;
  }

  /** 设置经度。 */
  public void setGeoLong(Double geoLong) {
    this.geoLong = geoLong;
  }
}
