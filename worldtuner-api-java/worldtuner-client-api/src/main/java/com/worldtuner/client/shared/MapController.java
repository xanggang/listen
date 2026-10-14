package com.worldtuner.client.shared;

import com.worldtuner.common.ApiError;
import com.worldtuner.common.ApiResult;
import com.worldtuner.domain.map.MapPointPage;
import com.worldtuner.domain.map.MapService;
import com.worldtuner.domain.map.MapSnapshot;
import com.worldtuner.domain.map.MapSnapshotCache;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 地图接口：游标点位页与全量快照。
 * 快照支持 gzip、ETag/304 与进程内 TTL 缓存，语义与 Worker 版一致。
 */
@RestController
@RequestMapping("/api/map")
public class MapController {

  /** 快照 TTL 配置：0 禁用缓存，最大允许一天；非法值在配置层回退为 300。 */
  private final int snapshotTtl;

  private final MapService mapService;

  private final MapSnapshotCache snapshotCache;

  /**
   * 注入地图服务与快照缓存。
   *
   * @param mapService    地图点位服务
   * @param snapshotCache 快照进程内缓存
   * @param snapshotTtl   配置的缓存秒数
   */
  public MapController(MapService mapService, MapSnapshotCache snapshotCache,
      @Value("${worldtuner.map-snapshot-ttl-seconds:300}") int snapshotTtl) {
    this.mapService = mapService;
    this.snapshotCache = snapshotCache;
    // TTL 上限一天，超限值收敛到 86400；负值视为非法回退 300。
    this.snapshotTtl = snapshotTtl < 0 ? 300 : Math.min(snapshotTtl, 86400);
  }

  /**
   * 返回与当前库详情 ID 一致的点位页，不包含播放地址。
   *
   * @param request HTTP 请求
   * @return 点位分页结果
   */
  @GetMapping({"/stations", "/stations/"})
  public ApiResult<MapPointPage> stations(HttpServletRequest request) {
    CommonQueryParser.MapQuery query = CommonQueryParser.parseMapQuery(request);
    return ApiResult.of(mapService.page(query.after(), query.limit()));
  }

  /**
   * 返回完整地图快照：支持 gzip 与 If-None-Match/304。
   * 快照不接受任何查询参数；缓存 TTL 由配置决定，0 表示每次重新构建。
   *
   * @param request HTTP 请求
   * @return 快照响应（200 或 304）
   */
  @GetMapping("/snapshot")
  public ResponseEntity<byte[]> snapshot(HttpServletRequest request) {
    if (request.getQueryString() != null) {
      throw new ApiError(400, "INVALID_QUERY", "Snapshot does not accept query parameters");
    }
    boolean gzip = EtagSupport.acceptsGzip(request.getHeader("Accept-Encoding"));
    MapSnapshot snapshot = snapshotCache.get(snapshotTtl);
    long remaining = Math.max(0, (snapshot.expiresAt() - System.currentTimeMillis()) / 1000);
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set(HttpHeaders.CACHE_CONTROL, "public, max-age=" + remaining);
    headers.setETag(snapshot.etag());
    headers.set(HttpHeaders.VARY, "Accept-Encoding");
    if (EtagSupport.matchesEtag(request.getHeader(HttpHeaders.IF_NONE_MATCH), snapshot.etag())) {
      // 弱比较命中：304 不携带正文与 Content-Encoding。
      return new ResponseEntity<>(headers, HttpStatus.NOT_MODIFIED);
    }
    byte[] payload = gzip ? snapshot.gzip() : snapshot.body();
    if (gzip) {
      // 正文已经是 gzip 字节，容器不得再次压缩。
      headers.set(HttpHeaders.CONTENT_ENCODING, "gzip");
    }
    return new ResponseEntity<>(payload, headers, HttpStatus.OK);
  }
}
