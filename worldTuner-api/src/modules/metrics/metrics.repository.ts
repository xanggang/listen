import type { SqlDatabase } from '../../database/database.ts';
import type { VisitRecord } from './metrics.types.ts';

// 所有 SQL 均限定在独立统计表，不读取电台或用户业务数据。
export class MetricsRepository {
  private readonly db: SqlDatabase;

  /**
   * 注入独立统计库或 Worker 数据库绑定。
   */
  constructor(db: SqlDatabase) {
    this.db = db;
  }

  /**
   * 原子写入一次 PV 与日、月去重值；重复访问只增加 PV。
   */
  async recordVisit(record: VisitRecord): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO metric_daily_views(day, source, page, pv) VALUES(?, ?, ?, 1)
           ON CONFLICT(day, source, page) DO UPDATE SET pv = pv + 1`,
        )
        .bind(record.day, record.source, record.page),
      this.db
        .prepare(
          'INSERT OR IGNORE INTO metric_daily_unique(day, source, visitor_hash) VALUES(?, ?, ?)',
        )
        .bind(record.day, record.source, record.dailyHash),
      this.db
        .prepare(
          'INSERT OR IGNORE INTO metric_monthly_unique(month, source, visitor_hash) VALUES(?, ?, ?)',
        )
        .bind(record.month, record.source, record.monthlyHash),
    ]);
  }

  /**
   * 每天重算已结束日期和月份，再清理超过保留期的匿名去重值。
   */
  async rollup(
    currentDay: string,
    currentMonth: string,
    dailyCutoff: string,
    monthlyCutoff: string,
  ) {
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO metric_daily_uv(day, source, uv)
           SELECT day, source, COUNT(*) FROM metric_daily_unique
           WHERE day < ? GROUP BY day, source
           ON CONFLICT(day, source) DO UPDATE SET uv = excluded.uv`,
        )
        .bind(currentDay),
      this.db
        .prepare(
          `INSERT INTO metric_monthly_mau(month, source, mau)
           SELECT month, source, COUNT(*) FROM metric_monthly_unique
           WHERE month < ? GROUP BY month, source
           ON CONFLICT(month, source) DO UPDATE SET mau = excluded.mau`,
        )
        .bind(currentMonth),
      this.db.prepare('DELETE FROM metric_daily_unique WHERE day < ?').bind(dailyCutoff),
      this.db.prepare('DELETE FROM metric_monthly_unique WHERE month < ?').bind(monthlyCutoff),
    ]);
  }
}
