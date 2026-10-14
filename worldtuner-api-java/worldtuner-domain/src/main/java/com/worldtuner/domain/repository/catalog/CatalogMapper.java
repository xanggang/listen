package com.worldtuner.domain.repository.catalog;

import com.worldtuner.domain.catalog.CountryItem;
import com.worldtuner.domain.catalog.LanguageItem;
import com.worldtuner.domain.catalog.TagItem;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.SelectProvider;

import java.util.List;

/**
 * 字典（标签 / 语种 / 国家）数据访问：SQL 与 Worker 版 catalog.repository.ts 保持一致。
 * 所有查询限定在公开电台口径上统计关联数量。
 */
public interface CatalogMapper {

  /**
   * 返回按公开关联数量排序的语种列表。
   *
   * @param limit 最大返回条数，由调用方校验后传入
   * @return 语种字典项列表
   */
  @SelectProvider(type = CatalogSqlProvider.class, method = "selectLanguages")
  List<LanguageItem> selectLanguages(@Param("limit") int limit);

  /**
   * 返回按公开关联数量排序的国家列表。
   *
   * @param limit 最大返回条数
   * @return 国家字典项列表
   */
  @SelectProvider(type = CatalogSqlProvider.class, method = "selectCountries")
  List<CountryItem> selectCountries(@Param("limit") int limit);

  /**
   * 按原名、英文或中文搜索标签；空关键词沿用相同的热度排序。
   *
   * @param pattern 已转义的 LIKE 模式，由调用方用 containsPattern 生成
   * @param limit   最大返回条数
   * @param offset  翻页偏移量
   * @return 标签字典项列表
   */
  @SelectProvider(type = CatalogSqlProvider.class, method = "searchTags")
  List<TagItem> searchTags(@Param("pattern") String pattern, @Param("limit") int limit,
      @Param("offset") int offset);

  /**
   * 按实体 ID 校验语种存在性。
   *
   * @param id 19 位十进制语种 ID
   * @return 语种名；不存在时为 null
   */
  @Select("SELECT name FROM language WHERE id = #{id}")
  String findLanguageName(@Param("id") String id);

  /**
   * 按实体 ID 校验标签存在性。
   *
   * @param id 19 位十进制标签 ID
   * @return 标签名；不存在时为 null
   */
  @Select("SELECT name FROM tag WHERE id = #{id}")
  String findTagName(@Param("id") String id);

  /**
   * 按实体 ID 校验国家存在性。
   *
   * @param id 19 位十进制国家 ID
   * @return 国家名；不存在时为 null
   */
  @Select("SELECT name FROM country WHERE id = #{id}")
  String findCountryName(@Param("id") String id);
}
