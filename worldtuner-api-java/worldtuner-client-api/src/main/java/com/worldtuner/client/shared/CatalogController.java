package com.worldtuner.client.shared;

import com.worldtuner.common.ApiResult;
import com.worldtuner.domain.catalog.CatalogService;
import com.worldtuner.domain.catalog.CountryItem;
import com.worldtuner.domain.catalog.LanguageItem;
import com.worldtuner.domain.catalog.TagItem;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 字典接口：标签、语种与国家。响应均为 {"data": [...]}，与 Worker 版一致。
 */
@RestController
@RequestMapping("/api")
public class CatalogController {

  private final CatalogService service;

  /**
   * 注入字典服务。
   *
   * @param service 字典业务服务
   */
  public CatalogController(CatalogService service) {
    this.service = service;
  }

  /**
   * 支持按名称搜索和偏移量分页；旧客户端仍收到 data 数组。
   *
   * @param request HTTP 请求
   * @return 标签字典项数组
   */
  @GetMapping({"/tags", "/tags/"})
  public ApiResult<List<TagItem>> tags(HttpServletRequest request) {
    CommonQueryParser.TagQuery query = CommonQueryParser.parseTagQuery(request);
    return ApiResult.of(service.searchTags(query.query(), query.limit(), query.offset()));
  }

  /**
   * 返回语种列表；默认最多 1000 项。
   *
   * @param request HTTP 请求
   * @return 语种字典项数组
   */
  @GetMapping({"/languages", "/languages/"})
  public ApiResult<List<LanguageItem>> languages(HttpServletRequest request) {
    return ApiResult.of(service.listLanguages(CommonQueryParser.parseCatalogLimit(request, 1000)));
  }

  /**
   * 返回国家列表；默认最多 30 项。
   *
   * @param request HTTP 请求
   * @return 国家字典项数组
   */
  @GetMapping({"/countries", "/countries/"})
  public ApiResult<List<CountryItem>> countries(HttpServletRequest request) {
    return ApiResult.of(service.listCountries(CommonQueryParser.parseCatalogLimit(request, 30)));
  }
}
