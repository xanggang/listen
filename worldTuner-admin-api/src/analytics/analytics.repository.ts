import type { SqlDatabase } from '../database/database.ts';
import type { analyticsQuery } from './analytics.schema.ts';
export interface DailyMetric {
  day: string;
  source: string;
  pv: number;
  uv: number;
}
export interface MonthlyMetric {
  month: string;
  source: string;
  mau: number;
}

/**
 * 按 UTC 日期读取汇总；尚未滚动汇总的日期使用短期去重表，已汇总的日期不重复计数。
 * UV/MAU 始终按平台返回，不将日 UV 相加当成范围内独立用户数。
 */
export async function readAnalytics(db: SqlDatabase, query: ReturnType<typeof analyticsQuery>) {
  const { from, to, source } = query;
  const daily = await db
    .prepare(
      `WITH views AS (
 SELECT day,source,SUM(pv) AS pv FROM metric_daily_views WHERE day BETWEEN ? AND ? GROUP BY day,source
 ), uniques AS (
 SELECT day,source,uv FROM metric_daily_uv WHERE day BETWEEN ? AND ?
 UNION ALL SELECT u.day,u.source,COUNT(*) AS uv FROM metric_daily_unique u WHERE u.day BETWEEN ? AND ?
 AND NOT EXISTS(SELECT 1 FROM metric_daily_uv a WHERE a.day=u.day AND a.source=u.source) GROUP BY u.day,u.source
 ), keys AS (SELECT day,source FROM views UNION SELECT day,source FROM uniques)
 SELECT k.day,k.source,COALESCE(v.pv,0) AS pv,COALESCE(u.uv,0) AS uv FROM keys k
 LEFT JOIN views v ON v.day=k.day AND v.source=k.source LEFT JOIN uniques u ON u.day=k.day AND u.source=k.source
 WHERE (? IS NULL OR k.source=?) ORDER BY k.day,k.source`,
    )
    .bind(from, to, from, to, from, to, source, source)
    .all<DailyMetric>();
  const monthly = await db
    .prepare(
      `SELECT month,source,mau FROM metric_monthly_mau WHERE month BETWEEN ? AND ? AND (? IS NULL OR source=?)
 UNION ALL SELECT u.month,u.source,COUNT(*) AS mau FROM metric_monthly_unique u WHERE u.month BETWEEN ? AND ? AND (? IS NULL OR u.source=?)
 AND NOT EXISTS(SELECT 1 FROM metric_monthly_mau a WHERE a.month=u.month AND a.source=u.source) GROUP BY u.month,u.source ORDER BY month,source`,
    )
    .bind(
      from.slice(0, 7),
      to.slice(0, 7),
      source,
      source,
      from.slice(0, 7),
      to.slice(0, 7),
      source,
      source,
    )
    .all<MonthlyMetric>();
  return { daily: daily.results, monthly: monthly.results, timezone: 'UTC', from, to };
}

/**
 * 总览只统计业务状态，不读取用户身份或播放轨迹。
 */
export async function readCatalogSummary(db: SqlDatabase) {
  const { results } = await db
    .prepare(
      'SELECT visibility_status AS visibility,catalog_status AS status,COUNT(*) AS count FROM station GROUP BY visibility_status,catalog_status',
    )
    .all<{ visibility: string; status: string; count: number }>();
  return results;
}
