import type { AuditEvent } from '../types.ts';
import type { ManagementStationRepository } from './stations.repository.ts';
import { ApiError } from '../shared/errors.ts';
import type { parseStationEdit, parseStreamEdit } from './stations.schema.ts';

/**
 * 新版本时间严格晚于客户端读取版本，避免同毫秒保存绕过乐观锁。
 */
function nextVersion(expected: string): string {
  const previous = Date.parse(expected);
  if (!Number.isFinite(previous) || previous > Date.now() + 60000)
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid record version');
  return new Date(Math.max(Date.now(), previous + 1)).toISOString();
}
export class ManagementStationService {
  private readonly repository: ManagementStationRepository;
  /**
   * 业务服务只依赖管理仓储，不依赖 HTTP 或 Worker 对象。
   */
  constructor(repository: ManagementStationRepository) {
    this.repository = repository;
  }
  /**
   * 详情不存在时返回明确 404，隐藏或失效站点仍允许管理员读取。
   */
  async detail(id: string) {
    const record = await this.repository.detail(id);
    if (!record) throw new ApiError(404, 'STATION_NOT_FOUND', 'Station not found');
    return record;
  }
  /**
   * 保存已校验基本信息，返回新的乐观锁版本与缓存生效窗口。
   */
  async edit(id: string, input: ReturnType<typeof parseStationEdit>, event: AuditEvent) {
    await this.detail(id);
    if (input.countryId && !(await this.repository.hasCountry(input.countryId)))
      throw new ApiError(400, 'INVALID_INPUT', 'Country does not exist');
    await this.repository.edit(id, input, nextVersion(input.expectedUpdatedAt), event);
    return this.detail(id);
  }
  /**
   * 保存可见性，所有管理写入都携带版本与审计事件。
   */
  async visibility(id: string, expected: string, visibility: string, event: AuditEvent) {
    await this.detail(id);
    await this.repository.visibility(id, expected, visibility, nextVersion(expected), event);
    return this.detail(id);
  }
  /**
   * 保存当前电台已有播放流；不允许对其他站点的流执行写入。
   */
  async stream(
    id: string,
    streamId: string,
    input: ReturnType<typeof parseStreamEdit>,
    event: AuditEvent,
  ) {
    const station = await this.detail(id);
    if (
      !station.streams.some(
        // 流 ID 必须来自本电台详情，不能只依赖调用方声称的归属。
        (stream) => stream.id === streamId,
      )
    )
      throw new ApiError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    await this.repository.stream(id, streamId, input, nextVersion(input.expectedUpdatedAt), event);
    return this.detail(id);
  }
}
