// SQLite 服务的单进程游客限流；多实例部署应在反向代理统一限流。
export class LocalRateLimiter {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();
  private readonly maximum: number;

  /**
   * 设置每个 IP 每分钟的额度，与 Worker 的配置口径一致。
   */
  constructor(maximum: number) {
    this.maximum = maximum;
  }

  /**
   * 累计窗口次数，清理过期桶；桶达到容量时拒绝新 IP，限制内存增长。
   */
  async limit({ key }: { key: string }): Promise<{ success: boolean }> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      for (const [id, entry] of this.buckets) {
        if (entry.expiresAt <= now) this.buckets.delete(id);
      }
      if (this.buckets.size >= 10000) return { success: false };
      bucket = { count: 0, expiresAt: now + 60000 };
      this.buckets.set(key, bucket);
    }
    bucket.count++;
    return { success: bucket.count <= this.maximum };
  }
}
