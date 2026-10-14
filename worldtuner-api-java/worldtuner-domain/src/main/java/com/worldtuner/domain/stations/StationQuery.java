package com.worldtuner.domain.stations;

/**
 * 电台列表查询参数：已完成校验的不可变结果，ID 均为 19 位字符串。
 *
 * @param page        页码，从 1 开始
 * @param pageSize    页大小，20 到 100 之间
 * @param offset      计算好的翻页偏移量
 * @param keyword     已去除首尾空白的关键词，可为空串
 * @param languagesId 语种筛选 ID，可为 null
 * @param tagsId      标签筛选 ID，可为 null
 * @param countriesId 国家筛选 ID，可为 null
 */
public record StationQuery(
    int page,
    int pageSize,
    int offset,
    String keyword,
    String languagesId,
    String tagsId,
    String countriesId) {
}
