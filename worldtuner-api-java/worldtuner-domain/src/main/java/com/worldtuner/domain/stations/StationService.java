package com.worldtuner.domain.stations;

import com.worldtuner.common.ApiError;
import com.worldtuner.common.QueryValidation;
import com.worldtuner.domain.catalog.CatalogKind;
import com.worldtuner.domain.catalog.CatalogService;
import com.worldtuner.domain.repository.catalog.StationMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 电台业务服务：详情组装与分页列表。
 * 与 Worker 版 stations.service.ts 语义一致。
 */
@Service
public class StationService {

  private final StationMapper mapper;

  private final CatalogService catalog;

  /**
   * 注入电台和分类依赖；所有运行环境共用相同业务规则。
   *
   * @param mapper  电台 mapper
   * @param catalog 字典服务，用于筛选 ID 校验
   */
  public StationService(StationMapper mapper, CatalogService catalog) {
    this.mapper = mapper;
    this.catalog = catalog;
  }

  /**
   * 只返回公开电台；播放流和链接仅在详情请求时加载。
   *
   * @param id 19 位十进制电台 ID
   * @return 电台详情
   * @throws ApiError 电台不存在或不可见时抛出 404 STATION_NOT_FOUND
   */
  public StationDetail detail(String id) {
    StationRow row = mapper.findById(id);
    if (row == null) {
      throw new ApiError(404, "STATION_NOT_FOUND", "Station not found");
    }
    StationDetail detail = new StationDetail();
    copyRow(row, detail);
    detail.setStreams(mapper.findStreams(id));
    detail.setLinks(mapper.findLinks(id));
    return detail;
  }

  /**
   * 校验关联分类后进行精确筛选；多读一条记录判断是否有下一页。
   *
   * @param query 已校验的查询参数
   * @return 分页结果
   */
  public StationPage list(StationQuery query) {
    catalog.validateId(CatalogKind.LANGUAGES, query.languagesId());
    catalog.validateId(CatalogKind.TAGS, query.tagsId());
    catalog.validateId(CatalogKind.COUNTRIES, query.countriesId());
    String pattern = query.keyword().isEmpty() ? null : QueryValidation.containsPattern(query.keyword());
    List<StationRow> rows = mapper.findPage(query, pattern, query.pageSize() + 1);
    boolean hasMore = rows.size() > query.pageSize();
    List<StationRow> page = hasMore ? rows.subList(0, query.pageSize()) : rows;
    return new StationPage(page, query.page(), query.pageSize(), hasMore,
        hasMore ? query.page() + 1 : null);
  }

  /**
   * 将列表行字段复制到详情对象；详情仅追加播放流与外链字段。
   *
   * @param row    列表查询得到的行对象
   * @param detail 目标详情对象
   */
  private void copyRow(StationRow row, StationDetail detail) {
    detail.setId(row.getId());
    detail.setName(row.getName());
    detail.setWebsite(row.getWebsite());
    detail.setFavicon(row.getFavicon());
    detail.setCountryId(row.getCountryId());
    detail.setCountry(row.getCountry());
    detail.setCountrycode(row.getCountrycode());
    detail.setGeoLat(row.getGeoLat());
    detail.setGeoLong(row.getGeoLong());
    detail.setVotes(row.getVotes());
    detail.setClickcount(row.getClickcount());
    detail.setSourceType(row.getSourceType());
    detail.setCatalogStatus(row.getCatalogStatus());
    detail.setCreatedAt(row.getCreatedAt());
    detail.setUpdatedAt(row.getUpdatedAt());
    detail.setUrl(row.getUrl());
    detail.setUrlResolved(row.getUrlResolved());
    detail.setCodec(row.getCodec());
    detail.setBitrate(row.getBitrate());
    detail.setHls(row.getHls());
    detail.setLastcheckok(row.getLastcheckok());
    detail.setTags(row.getTags());
    detail.setLanguage(row.getLanguage());
    detail.setLanguageEn(row.getLanguageEn());
    detail.setLanguageZh(row.getLanguageZh());
    detail.setLanguagecodes(row.getLanguagecodes());
  }
}
