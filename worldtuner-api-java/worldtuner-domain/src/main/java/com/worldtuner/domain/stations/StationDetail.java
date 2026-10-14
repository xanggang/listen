package com.worldtuner.domain.stations;

import java.util.List;

/**
 * 电台详情：在列表字段基础上补充全部 HTTP(S) 播放流与外链，字段名与 Worker 版详情响应一致。
 */
public class StationDetail extends StationRow {

  /** 全部可用的 HTTP(S) 播放流，排序与默认流选择一致。 */
  private List<StreamRow> streams;

  /** 网站和社交外链列表。 */
  private List<LinkRow> links;

  /** 创建空对象，供服务层填充。 */
  public StationDetail() {
  }

  /** 返回播放流列表。 */
  public List<StreamRow> getStreams() {
    return streams;
  }

  /** 设置播放流列表。 */
  public void setStreams(List<StreamRow> streams) {
    this.streams = streams;
  }

  /** 返回外链列表。 */
  public List<LinkRow> getLinks() {
    return links;
  }

  /** 设置外链列表。 */
  public void setLinks(List<LinkRow> links) {
    this.links = links;
  }
}
