package com.worldtuner.domain.map;

import com.worldtuner.domain.repository.catalog.MapMapper;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

/**
 * 地图快照进程内缓存：同一实例的并发请求共用生成任务。
 * 语义与 Worker 版 map.snapshot.ts 的 getMapSnapshot 一致：
 * TTL 从查询开始计时；失败不会缓存，0 秒时每次重新读取数据库。
 */
@Component
public class MapSnapshotCache {

  private final MapMapper mapper;

  private SnapshotEntry entry;

  /**
   * 注入点位 mapper，快照构建直接读取数据库。
   *
   * @param mapper 地图点位 mapper
   */
  public MapSnapshotCache(MapMapper mapper) {
    this.mapper = mapper;
  }

  /**
   * 获取完整快照；并发请求共享同一次生成任务。
   *
   * @param ttl 缓存秒数；0 表示每次重新构建
   * @return 快照对象
   */
  public MapSnapshot get(int ttl) {
    if (ttl <= 0) {
      return build();
    }
    synchronized (this) {
      SnapshotEntry current = entry;
      if (current != null && current.ttl == ttl && current.expiresAt > System.currentTimeMillis()) {
        return current.future.join();
      }
      long expiresAt = System.currentTimeMillis() + ttl * 1000L;
      CompletableFuture<MapSnapshot> future = CompletableFuture.supplyAsync(this::build);
      entry = new SnapshotEntry(ttl, expiresAt, future);
      return future.join();
    }
  }

  /**
   * 读取数据库并构建快照；失败时清理缓存条目，让下一次请求重试。
   *
   * @return 新构建的快照
   */
  private MapSnapshot build() {
    try {
      return MapSnapshotBuilder.build(mapper.findAll(), System.currentTimeMillis());
    } catch (RuntimeException e) {
      synchronized (this) {
        // 构建失败时移除条目；失败不会缓存。
        entry = null;
      }
      throw e;
    }
  }

  /**
   * 缓存条目：记录 TTL 与过期时间，值由共享任务提供。
   *
   * @param ttl       配置的缓存秒数
   * @param expiresAt 过期时间戳（毫秒）
   * @param future    共享的构建任务
   */
  private record SnapshotEntry(int ttl, long expiresAt, CompletableFuture<MapSnapshot> future) {

    /**
     * 获取快照；构建失败时转换为未受检异常，由统一错误处理兜底。
     *
     * @return 快照对象
     */
    MapSnapshot join() {
      try {
        return future.get();
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("map snapshot interrupted", e);
      } catch (ExecutionException e) {
        throw new IllegalStateException("map snapshot failed", e.getCause());
      }
    }
  }
}
