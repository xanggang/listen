// 公开列表、分类计数、地图及详情共用的可见性条件；SQL 别名固定为 s。
export const publicStation =
  "s.visibility_status = 'visible' AND s.catalog_status != 'unavailable'";
