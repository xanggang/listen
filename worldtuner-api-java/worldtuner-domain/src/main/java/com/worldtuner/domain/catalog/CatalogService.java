package com.worldtuner.domain.catalog;

import com.worldtuner.common.ApiError;
import com.worldtuner.common.QueryValidation;
import com.worldtuner.domain.repository.catalog.CatalogMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 字典业务服务：列表查询、标签搜索与关联 ID 校验。
 * 与 Worker 版 catalog.service.ts 语义一致。
 */
@Service
public class CatalogService {

  private final CatalogMapper mapper;

  /**
   * 注入字典数据访问依赖，便于独立测试业务规则。
   *
   * @param mapper 字典 mapper
   */
  public CatalogService(CatalogMapper mapper) {
    this.mapper = mapper;
  }

  /**
   * 返回语种列表。
   *
   * @param limit 最大返回条数
   * @return 语种字典项列表
   */
  public List<LanguageItem> listLanguages(int limit) {
    return mapper.selectLanguages(limit);
  }

  /**
   * 返回国家列表。
   *
   * @param limit 最大返回条数
   * @return 国家字典项列表
   */
  public List<CountryItem> listCountries(int limit) {
    return mapper.selectCountries(limit);
  }

  /**
   * 分页搜索标签，空关键词也沿用相同的热度排序。
   *
   * @param query  关键词原值（未转义）
   * @param limit  最大返回条数
   * @param offset 翻页偏移量
   * @return 标签字典项列表
   */
  public List<TagItem> searchTags(String query, int limit, int offset) {
    return mapper.searchTags(QueryValidation.containsPattern(query), limit, offset);
  }

  /**
   * 验证可选分类 ID；未知 ID 返回 400，防止误返回全量电台。
   *
   * @param kind 字典类型
   * @param id   19 位十进制实体 ID；null 表示未启用该筛选
   */
  public void validateId(CatalogKind kind, String id) {
    if (id == null) {
      return;
    }
    String name = switch (kind) {
      case LANGUAGES -> mapper.findLanguageName(id);
      case TAGS -> mapper.findTagName(id);
      case COUNTRIES -> mapper.findCountryName(id);
    };
    if (name == null) {
      throw new ApiError(400, "INVALID_FILTER", "Unknown " + kind.apiName() + " id");
    }
  }
}
