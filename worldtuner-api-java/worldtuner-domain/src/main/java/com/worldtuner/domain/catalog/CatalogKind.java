package com.worldtuner.domain.catalog;

/**
 * 字典类型枚举：固定映射限定表名和关系字段，外部输入永远不作为 SQL 标识符。
 * 标识符取值与 worldTuner-api（Worker 版）catalog.repository.ts 的固定映射一致。
 */
public enum CatalogKind {

  /** 语种字典：主表 language，经 station_language 关联电台。 */
  LANGUAGES("language", "station_language", "language_id"),

  /** 标签字典：主表 tag，经 station_tag 关联电台。 */
  TAGS("tag", "station_tag", "tag_id"),

  /** 国家字典：主表 country，电台通过 country_id 直接关联。 */
  COUNTRIES("country", null, null);

  /** 字典主表名，仅允许来自本枚举固定值。 */
  private final String table;

  /** 关联表名；国家不使用关联表，为 null。 */
  private final String relationTable;

  /** 关联表中指向字典主表的外键字段名。 */
  private final String relationColumn;

  /**
   * 创建字典类型。
   *
   * @param table          字典主表名
   * @param relationTable  关联表名，国家为 null
   * @param relationColumn 关联外键字段名，国家为 null
   */
  CatalogKind(String table, String relationTable, String relationColumn) {
    this.table = table;
    this.relationTable = relationTable;
    this.relationColumn = relationColumn;
  }

  /** 返回字典主表名。 */
  public String getTable() {
    return table;
  }

  /** 返回关联表名；国家无关联表。 */
  public String getRelationTable() {
    return relationTable;
  }

  /** 返回关联外键字段名；国家无关联字段。 */
  public String getRelationColumn() {
    return relationColumn;
  }

  /**
   * 返回错误文案与 API 参数使用的类型名（小写复数形式）。
   *
   * @return 例如 languages、tags、countries
   */
  public String apiName() {
    return name().toLowerCase(java.util.Locale.ROOT);
  }
}
