package com.worldtuner.domain.map;

import java.util.List;

/**
 * 地图点位分页结果。
 *
 * @param list       当前页点位
 * @param nextCursor 下一页游标；无后续页时为 null
 */
public record MapPointPage(List<MapPoint> list, String nextCursor) {
}
