// 仓储层使用的最小数据库契约；D1 绑定可直接实现，SQLite 由适配器实现。
export type SqlValue = string | number | null;
export interface SqlStatement {
  bind(...values: SqlValue[]): SqlStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<unknown[]>;
}
