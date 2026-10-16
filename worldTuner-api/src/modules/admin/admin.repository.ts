import type { SqlDatabase } from '../../database/database.ts';
import type { StationVisibility } from './admin.types.ts';

export class AdminRepository {
  private readonly db: SqlDatabase;
  /**
   * 注入管理专用写连接；D1 使用业务绑定，SQLite 可与公开只读连接分开。
   */
  constructor(db: SqlDatabase) {
    this.db = db;
  }

  /**
   * 按 public_id 原子更新可见性及时间，返回对外 ID；不存在返回 null。
   * ID、状态与 UTC 时间均使用参数绑定，不更新其他业务字段。
   */
  async setVisibility(id: string, visibility: StationVisibility, updatedAt: string) {
    return this.db
      .prepare(
        'UPDATE station SET visibility_status = ?, updated_at = ? WHERE public_id COLLATE BINARY = ? RETURNING public_id AS id',
      )
      .bind(visibility, updatedAt, id)
      .first<{ id: string }>();
  }
}
