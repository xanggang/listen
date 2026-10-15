package com.worldtuner.domain.stations;

/**
 * 电台列表 / 详情行对象，同时承担对外 DTO 职责。
 * 字段名与 Worker 版 stations.dto.ts 输出的 JSON key 一一对应：
 * 驼峰字段直接序列化（countryId、geoLat、urlResolved 等），全小写字段保持原名
 * （countrycode、lastcheckok、languagecodes）。
 */
public class StationRow {

  /** 19 位十进制电台 ID，保持字符串原值及前导零。 */
  private String id;

  /** 电台名称。 */
  private String name;

  /** 电台主页，可能为 null。 */
  private String website;

  /** 电台图标地址，可能为 null。 */
  private String favicon;

  /** 关联国家 ID，可能为 null。 */
  private String countryId;

  /** 国家名，可能为 null。 */
  private String country;

  // 国家展示译名为空时，客户端沿用原始 country。
  private String countryEn;
  private String countryZh;

  /** 两位国家代码，可能为 null。 */
  private String countrycode;

  /** 纬度，可能为 null。 */
  private Double geoLat;

  /** 经度，可能为 null。 */
  private Double geoLong;

  /** 数据源票数，可能为 null。 */
  private Integer votes;

  /** 数据源点击数，可能为 null。 */
  private Integer clickcount;

  /** 来源类型：radio_browser / radio_garden / both。 */
  private String sourceType;

  /** 目录状态：active / unverified / unavailable。 */
  private String catalogStatus;

  /** 创建时间（原样输出库内文本）。 */
  private String createdAt;

  /** 更新时间（原样输出库内文本）。 */
  private String updatedAt;

  /** 默认播放流地址；缺流时为 null。 */
  private String url;

  /** 重定向解析后的播放流地址，可能为 null。 */
  private String urlResolved;

  /** 编码格式，可能为 null。 */
  private String codec;

  /** 比特率，可能为 null。 */
  private Integer bitrate;

  /** 是否 HLS 流：0 / 1 / null（未知）。 */
  private Integer hls;

  /** 最近检查结果：0 / 1 / null（未知）。 */
  private Integer lastcheckok;

  /** 逗号拼接的标签名列表，可能为 null。 */
  private String tags;

  /** 逗号拼接的语种原名列表，可能为 null。 */
  private String language;

  /** 逗号拼接的语种英文名列表（原文回退），可能为 null。 */
  private String languageEn;

  /** 逗号拼接的语种中文名列表（中→英→原文回退），可能为 null。 */
  private String languageZh;

  /** 逗号拼接的语言代码列表，可能为 null。 */
  private String languagecodes;

  /** 创建空对象，供 MyBatis 反射填充字段。 */
  public StationRow() {
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

  /** 返回电台主页。 */
  public String getWebsite() {
    return website;
  }

  /** 设置电台主页。 */
  public void setWebsite(String website) {
    this.website = website;
  }

  /** 返回电台图标地址。 */
  public String getFavicon() {
    return favicon;
  }

  /** 设置电台图标地址。 */
  public void setFavicon(String favicon) {
    this.favicon = favicon;
  }

  /** 返回关联国家 ID。 */
  public String getCountryId() {
    return countryId;
  }

  /** 设置关联国家 ID。 */
  public void setCountryId(String countryId) {
    this.countryId = countryId;
  }

  /** 返回国家名。 */
  public String getCountry() {
    return country;
  }

  /** 设置国家名。 */
  public void setCountry(String country) {
    this.country = country;
  }

  /**
   * 返回可空英文国家展示名，原始 country 保持不变。
   */
  public String getCountryEn() {
    return countryEn;
  }

  /**
   * 接收关联国家的英文展示名。
   */
  public void setCountryEn(String countryEn) {
    this.countryEn = countryEn;
  }

  /**
   * 返回可空中文国家展示名，供客户端按语言选择。
   */
  public String getCountryZh() {
    return countryZh;
  }

  /**
   * 接收关联国家的中文展示名。
   */
  public void setCountryZh(String countryZh) {
    this.countryZh = countryZh;
  }

  /** 返回两位国家代码。 */
  public String getCountrycode() {
    return countrycode;
  }

  /** 设置两位国家代码。 */
  public void setCountrycode(String countrycode) {
    this.countrycode = countrycode;
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

  /** 返回数据源票数。 */
  public Integer getVotes() {
    return votes;
  }

  /** 设置数据源票数。 */
  public void setVotes(Integer votes) {
    this.votes = votes;
  }

  /** 返回数据源点击数。 */
  public Integer getClickcount() {
    return clickcount;
  }

  /** 设置数据源点击数。 */
  public void setClickcount(Integer clickcount) {
    this.clickcount = clickcount;
  }

  /** 返回来源类型。 */
  public String getSourceType() {
    return sourceType;
  }

  /** 设置来源类型。 */
  public void setSourceType(String sourceType) {
    this.sourceType = sourceType;
  }

  /** 返回目录状态。 */
  public String getCatalogStatus() {
    return catalogStatus;
  }

  /** 设置目录状态。 */
  public void setCatalogStatus(String catalogStatus) {
    this.catalogStatus = catalogStatus;
  }

  /** 返回创建时间。 */
  public String getCreatedAt() {
    return createdAt;
  }

  /** 设置创建时间。 */
  public void setCreatedAt(String createdAt) {
    this.createdAt = createdAt;
  }

  /** 返回更新时间。 */
  public String getUpdatedAt() {
    return updatedAt;
  }

  /** 设置更新时间。 */
  public void setUpdatedAt(String updatedAt) {
    this.updatedAt = updatedAt;
  }

  /** 返回默认播放流地址。 */
  public String getUrl() {
    return url;
  }

  /** 设置默认播放流地址。 */
  public void setUrl(String url) {
    this.url = url;
  }

  /** 返回解析后的播放流地址。 */
  public String getUrlResolved() {
    return urlResolved;
  }

  /** 设置解析后的播放流地址。 */
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

  /** 返回最近检查结果。 */
  public Integer getLastcheckok() {
    return lastcheckok;
  }

  /** 设置最近检查结果。 */
  public void setLastcheckok(Integer lastcheckok) {
    this.lastcheckok = lastcheckok;
  }

  /** 返回标签名列表。 */
  public String getTags() {
    return tags;
  }

  /** 设置标签名列表。 */
  public void setTags(String tags) {
    this.tags = tags;
  }

  /** 返回语种原名列表。 */
  public String getLanguage() {
    return language;
  }

  /** 设置语种原名列表。 */
  public void setLanguage(String language) {
    this.language = language;
  }

  /** 返回语种英文名列表。 */
  public String getLanguageEn() {
    return languageEn;
  }

  /** 设置语种英文名列表。 */
  public void setLanguageEn(String languageEn) {
    this.languageEn = languageEn;
  }

  /** 返回语种中文名列表。 */
  public String getLanguageZh() {
    return languageZh;
  }

  /** 设置语种中文名列表。 */
  public void setLanguageZh(String languageZh) {
    this.languageZh = languageZh;
  }

  /** 返回语言代码列表。 */
  public String getLanguagecodes() {
    return languagecodes;
  }

  /** 设置语言代码列表。 */
  public void setLanguagecodes(String languagecodes) {
    this.languagecodes = languagecodes;
  }
}
