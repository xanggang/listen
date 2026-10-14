package com.worldtuner.domain.stations;

import java.util.List;

/**
 * 电台分页结果：字段名与 Worker 版 list 响应一致；无下一页时 nextPage 为 null。
 *
 * @param list     当前页电台列表
 * @param page     当前页码
 * @param pageSize 页大小
 * @param hasMore  是否还有下一页
 * @param nextPage 下一页页码；无下一页时为 null
 */
public record StationPage(
    List<StationRow> list,
    int page,
    int pageSize,
    boolean hasMore,
    Integer nextPage) {
}
