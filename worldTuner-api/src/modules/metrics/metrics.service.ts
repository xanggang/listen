import type { MetricsRepository } from './metrics.repository.ts';
import type { VisitInput, VisitRecord } from './metrics.types.ts';

/** 将高熵匿名 UUID 与日期结合哈希，避免 D1 保存原始标识或跨期关联标识。 */
async function scopedHash(scope: string, visitorId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`worldtuner-metrics-v1:${scope}:${visitorId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// 统计服务只负责日期口径和匿名化，不依赖 HTTP 框架。
export class MetricsService {
  private readonly repository: MetricsRepository;

  /** 注入与页面访问量独立的 D1 repository。 */
  constructor(repository: MetricsRepository) {
    this.repository = repository;
  }

  /** 以 Worker 接收时间作为 UTC 日期，避免客户端时间篡改统计日期。 */
  async recordVisit(input: VisitInput): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const record: VisitRecord = {
      day,
      month,
      source: input.source,
      page: input.page,
      dailyHash: await scopedHash(`day:${day}`, input.visitorId),
      monthlyHash: await scopedHash(`month:${month}`, input.visitorId),
    };
    await this.repository.recordVisit(record);
  }

  /** 汇总已结束周期；日标识保留 35 天，月标识保留最近两个月。 */
  async rollup(now = new Date()): Promise<void> {
    const day = now.toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const dailyCutoff = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const monthlyCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1))
      .toISOString()
      .slice(0, 7);
    await this.repository.rollup(day, month, dailyCutoff, monthlyCutoff);
  }
}
