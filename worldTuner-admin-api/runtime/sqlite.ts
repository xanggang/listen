import { DatabaseSync } from 'node:sqlite';
import type { SqlDatabase, SqlStatement, SqlValue } from '../src/database/database.ts';

// SQLite 语句包装保留原连接，防止跨库 batch 或异步事务串扰。
class SQLiteStatement implements SqlStatement {
  private readonly connection: DatabaseSync;
  private readonly sql: string;
  private values: SqlValue[] = [];

  /**
   * 保存 SQL 和所属连接；准备阶段不执行 SQL 或写入。
   */
  constructor(connection: DatabaseSync, sql: string) {
    this.connection = connection;
    this.sql = sql;
  }

  /**
   * 返回新的绑定语句，不覆盖已绑定实例的参数。
   */
  bind(...values: SqlValue[]): SQLiteStatement {
    const statement = new SQLiteStatement(this.connection, this.sql);
    statement.values = values;
    return statement;
  }

  /**
   * 返回首条记录，空结果与 D1 一致返回 null。
   */
  async first<T>(): Promise<T | null> {
    return (this.connection.prepare(this.sql).get(...this.values) as T | undefined) ?? null;
  }

  /**
   * 将 SQLite 列表包装成仓储层统一的 results 字段。
   */
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.connection.prepare(this.sql).all(...this.values) as T[] };
  }

  /**
   * 执行单条写入；实际同步执行可保证 batch 事务内没有异步间隙。
   */
  execute(connection: DatabaseSync): unknown {
    if (connection !== this.connection) throw new Error('Cross-database batch is not supported');
    return this.connection.prepare(this.sql).run(...this.values);
  }

  /**
   * 提供与 D1 相同的异步写入接口。
   */
  async run(): Promise<unknown> {
    return this.execute(this.connection);
  }
}

export class SQLiteDatabase implements SqlDatabase {
  readonly connection: DatabaseSync;

  /**
   * 打开本地 SQLite；调用方必须明确只读策略，外键约束始终启用。
   */
  constructor(path: string, readOnly = true) {
    this.connection = new DatabaseSync(path, { readOnly, timeout: 5000 });
    this.connection.exec('PRAGMA foreign_keys = ON');
  }

  /**
   * 创建统一语句包装，所有外部值必须通过 bind 传入。
   */
  prepare(sql: string): SqlStatement {
    return new SQLiteStatement(this.connection, sql);
  }

  /**
   * 同步执行原子批次；任何语句失败均回滚，不提交部分 PV/UV 记录。
   */
  async batch(statements: SqlStatement[]): Promise<unknown[]> {
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) {
        if (!(statement instanceof SQLiteStatement)) throw new Error('Invalid SQLite statement');
        results.push(statement.execute(this.connection));
      }
      this.connection.exec('COMMIT');
      return results;
    } catch (error) {
      this.connection.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * 关闭连接；由服务停机或测试清理调用。
   */
  close(): void {
    this.connection.close();
  }
}
