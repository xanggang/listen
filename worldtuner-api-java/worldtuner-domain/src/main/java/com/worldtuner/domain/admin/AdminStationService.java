package com.worldtuner.domain.admin;

import com.worldtuner.common.ApiError;
import com.worldtuner.domain.repository.catalog.AdminStationMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;

/**
 * 管理端电台业务：可见性上下架。
 * 属于 admin 模块专用写能力；公开 API 保持只读。
 */
@Service
public class AdminStationService {

  // 允许设置的可见性状态；与建表约束一致。
  private static final Set<String> ALLOWED_VISIBILITY = Set.of("visible", "hidden");

  private final AdminStationMapper mapper;

  /**
   * 注入管理端 mapper。
   *
   * @param mapper 管理端电台 mapper
   */
  public AdminStationService(AdminStationMapper mapper) {
    this.mapper = mapper;
  }

  /**
   * 设置电台可见性；不存在的电台返回 404，非法状态返回 400。
   *
   * @param id         19 位十进制电台 ID
   * @param visibility 目标状态：visible / hidden
   * @return 更新后的状态值
   */
  @Transactional(transactionManager = "catalogTransactionManager")
  public String setVisibility(String id, String visibility) {
    if (visibility == null || !ALLOWED_VISIBILITY.contains(visibility)) {
      throw new ApiError(400, "INVALID_PARAMETER",
          "visibility must be 'visible' or 'hidden'");
    }
    if (mapper.findNameById(id) == null) {
      throw new ApiError(404, "STATION_NOT_FOUND", "Station not found");
    }
    String updatedAt = Instant.now().truncatedTo(ChronoUnit.SECONDS).toString();
    mapper.updateVisibility(id, visibility, updatedAt);
    return visibility;
  }
}
