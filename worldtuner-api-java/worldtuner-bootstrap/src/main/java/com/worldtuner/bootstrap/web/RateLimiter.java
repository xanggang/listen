package com.worldtuner.bootstrap.web;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 进程内固定窗口限流器：以客户端 IP 为粗粒度标识的访客滥用启发式，
 * 不是用户身份或计费上限。语义对齐 Worker 版 wrangler simple rate limit。
 */
@Component
public class RateLimiter {

  /** 单个限流桶：滑动保留最近一分钟的请求时间戳。 */
  private static final long WINDOW_MILLIS = 60_000;

  /** 桶上限：防止无限增长，超出的 IP 共享淘汰。 */
  private static final int MAX_BUCKETS = 100_000;

  private final Map<String, Deque<Long>> buckets = new ConcurrentHashMap<>();

  /**
   * 判断请求是否放行；放行时记录本次请求时间。
   *
   * @param scope 限流域：read / search / metrics，域之间互不影响
   * @param key   客户端标识（IP 或 unknown）
   * @param limit 每分钟允许的请求数
   * @return 放行返回 true；超限返回 false
   */
  public boolean tryAcquire(String scope, String key, int limit) {
    if (buckets.size() > MAX_BUCKETS) {
      buckets.clear();
    }
    long now = System.currentTimeMillis();
    Deque<Long> timestamps = buckets.computeIfAbsent(scope + ":" + key, k -> new ArrayDeque<>());
    synchronized (timestamps) {
      while (!timestamps.isEmpty() && now - timestamps.peekFirst() >= WINDOW_MILLIS) {
        timestamps.pollFirst();
      }
      if (timestamps.size() >= limit) {
        return false;
      }
      timestamps.addLast(now);
      return true;
    }
  }
}
