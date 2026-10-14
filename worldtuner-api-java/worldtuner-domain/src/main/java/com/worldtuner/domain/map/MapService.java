package com.worldtuner.domain.map;

import com.worldtuner.domain.repository.catalog.MapMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 地图点位业务服务：游标分页组装。
 * 与 Worker 版 map.service.ts 语义一致。
 */
@Service
public class MapService {

  private final MapMapper mapper;

  /**
   * 注入点位仓储；地图的分页响应组装与 HTTP 路由和 SQL 分离。
   *
   * @param mapper 地图点位 mapper
   */
  public MapService(MapMapper mapper) {
    this.mapper = mapper;
  }

  /**
   * 组装轻量点位页；多读的一条不对外返回，无后续页时游标为 null。
   *
   * @param after 游标 ID，可为 null
   * @param limit 页大小（已校验）
   * @return 分页结果：list + nextCursor
   */
  public MapPointPage page(String after, int limit) {
    List<MapPoint> rows = mapper.findPage(after, limit + 1);
    List<MapPoint> list = rows.size() > limit ? rows.subList(0, limit) : rows;
    String nextCursor = rows.size() > limit ? list.get(list.size() - 1).getId() : null;
    return new MapPointPage(list, nextCursor);
  }
}
