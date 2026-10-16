import type { ReactNode } from 'react';
/**
 * 管理页面统一标题、说明与操作区域。
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">WORKSPACE / ADMINISTRATION</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
/**
 * 显示真实加载、空列表与失败状态，失败保留手动重试入口。
 */
export function ResourceState({
  loading,
  error,
  empty,
  retry,
}: {
  loading: boolean;
  error: string;
  empty?: boolean;
  retry: () => void;
}) {
  if (loading)
    return (
      <div className="state" role="status">
        正在加载…
      </div>
    );
  if (error)
    return (
      <div className="state error" role="alert">
        <p>{error}</p>
        <button onClick={retry}>重新加载</button>
      </div>
    );
  if (empty) return <div className="state">当前条件下没有数据</div>;
  return null;
}
/**
 * 有界分页不改变筛选，页大小与服务端管理契约一致。
 */
export function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <div className="pager">
      <span>
        共 {total.toLocaleString()} 条 · 第 {page} / {pages} 页
      </span>
      <div>
        <button
          disabled={page <= 1}
          onClick={
            // 返回上一页，保留当前查询条件。
            () => onChange(page - 1)
          }
        >
          上一页
        </button>
        <button
          disabled={page >= pages}
          onClick={
            // 前进到下一页，不超出总页数。
            () => onChange(page + 1)
          }
        >
          下一页
        </button>
      </div>
    </div>
  );
}
/**
 * 保存反馈统一使用 live region，失败不关闭编辑窗口。
 */
export function Notice({ message }: { message: string }) {
  return message ? (
    <div className="notice" role="status">
      {message}
    </div>
  ) : null;
}
/**
 * 标签文案保持业务含义，未知状态保留原值便于诊断。
 */
export function Status({ value }: { value: string }) {
  const names: Record<string, string> = {
    visible: '已上架',
    hidden: '已下架',
    active: '可用',
    unverified: '未验证',
    unavailable: '不可用',
    open: '待处理',
    resolved: '已解决',
    ignored: '已忽略',
  };
  return (
    <span
      className={`badge ${['visible', 'active', 'resolved'].includes(value) ? 'positive' : ''}`}
    >
      {names[value] ?? value}
    </span>
  );
}
