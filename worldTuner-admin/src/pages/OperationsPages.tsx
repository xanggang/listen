import { useState } from 'react';
import type { Page, Report, Audit, Logs } from '../lib/contracts';
import { useResource } from '../lib/hooks';
import { save, errorMessage } from '../lib/api';
import {
  Notice,
  PageHeader,
  Pager,
  ResourceState,
  Status,
} from '../components/common';

/**
 * 错误报告读取真实运营样本；未接入客户端上报时明确显示能力边界。
 */
export function ReportsPage({ writable }: { writable: boolean }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const resource = useResource<Page<Report> & { ingestionEnabled: boolean }>(
    `/admin/api/reports?page=${page}${status ? `&status=${status}` : ''}`,
  );
  /**
   * 改变处理状态必须带原状态；失败时不改变当前列表，防止显示未保存结果。
   */
  async function update(report: Report, value: string) {
    setBusy(true);
    try {
      await save(`/admin/api/reports/${encodeURIComponent(report.id)}/status`, {
        status: value,
        expectedStatus: report.status,
      });
      setMessage('处理状态已保存');
      resource.refresh();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="错误报告"
        description="查看错误摘要与处理状态，不记录完整播放轨迹或用户身份"
        action={<button onClick={resource.refresh}>刷新</button>}
      />
      <Notice message={message} />
      {resource.data && !resource.data.ingestionEnabled && (
        <div className="notice">
          客户端错误上报尚未接入；此页只展示运营库已存在的报告，不生成模拟数据。
        </div>
      )}
      <section className="panel">
        <div className="toolbar">
          <label>
            处理状态
            <select
              value={status}
              onChange={
                // 状态过滤从第一页重新查询。
                (event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }
              }
            >
              <option value="">全部</option>
              <option value="open">待处理</option>
              <option value="resolved">已解决</option>
              <option value="ignored">已忽略</option>
            </select>
          </label>
        </div>
        <ResourceState
          loading={resource.loading}
          error={resource.error}
          empty={resource.data?.list.length === 0}
          retry={resource.refresh}
        />
        {resource.data && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>错误摘要</th>
                    <th>平台 / 版本</th>
                    <th>状态</th>
                    <th>时间 UTC</th>
                    <th>处理</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.list.map(
                    // 文本由 React 转义，不以 HTML 注入错误消息。
                    (report) => (
                      <tr key={report.id}>
                        <td>
                          <strong>{report.errorCode}</strong>
                          <small>
                            {report.eventType} · {report.message}
                          </small>
                          {report.requestId && (
                            <small className="mono">
                              请求 {report.requestId}
                            </small>
                          )}
                        </td>
                        <td>
                          {report.platform}
                          <small>{report.appVersion}</small>
                        </td>
                        <td>
                          <Status value={report.status} />
                        </td>
                        <td className="mono">{report.createdAt}</td>
                        <td>
                          {writable ? (
                            <select
                              aria-label={`处理 ${report.errorCode}`}
                              value={report.status}
                              disabled={busy}
                              onChange={
                                // 状态只允许服务端定义的固定枚举。
                                (event) =>
                                  void update(report, event.target.value)
                              }
                            >
                              <option value="open">待处理</option>
                              <option value="resolved">已解决</option>
                              <option value="ignored">已忽略</option>
                            </select>
                          ) : (
                            <span className="muted">只读</span>
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={resource.data.total} onChange={setPage} />
          </>
        )}
      </section>
    </>
  );
}
/**
 * 操作审计只读，显示服务器生成的身份、实体与变更字段，不提供删除功能。
 */
export function AuditPage() {
  const [page, setPage] = useState(1);
  const resource = useResource<Page<Audit>>(`/admin/api/audit?page=${page}`);
  return (
    <>
      <PageHeader
        title="操作审计"
        description="管理操作的交付记录 · 不含 Token、请求正文或完整播放地址"
        action={<button onClick={resource.refresh}>刷新</button>}
      />
      <section className="panel">
        <ResourceState
          loading={resource.loading}
          error={resource.error}
          empty={resource.data?.list.length === 0}
          retry={resource.refresh}
        />
        {resource.data && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>动作 / 实体</th>
                    <th>管理员</th>
                    <th>变更字段</th>
                    <th>时间 UTC</th>
                    <th>请求 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.list.map(
                    // 稳定审计 ID 支持 outbox 重试后的幂等去重。
                    (row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.action}</strong>
                          <small className="mono">
                            {row.entityType} / {row.entityId}
                          </small>
                        </td>
                        <td className="mono">{row.actorId}</td>
                        <td className="mono">{row.changedFields}</td>
                        <td className="mono">{row.createdAt}</td>
                        <td className="mono">{row.requestId}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={resource.data.total} onChange={setPage} />
          </>
        )}
      </section>
    </>
  );
}
/**
 * 首版运行日志使用 Cloudflare 原生控制台，未实现的网页查询不伪装成空日志。
 */
export function LogsPage() {
  const resource = useResource<Logs>('/admin/api/logs');
  return (
    <>
      <PageHeader
        title="运行日志"
        description="通过 Cloudflare Workers Logs 按请求 ID 排查服务端故障"
      />
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        retry={resource.refresh}
      />
      {resource.data && (
        <section className="panel logs-guide">
          <span className="badge">Cloudflare Workers Logs</span>
          <h2>前往 Cloudflare 控制台查询</h2>
          <p>{resource.data.message}</p>
          <ol>
            <li>选择 worldtuner-api 或 worldtuner-admin Worker。</li>
            <li>打开 Observability / Logs，限制查询时间范围。</li>
            <li>用页面报错中的请求 ID 关联服务端记录。</li>
          </ol>
          <a
            className="button primary"
            href={resource.data.consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            打开 Cloudflare 控制台 ↗
          </a>
          <p className="muted">
            此页面不保存 Cloudflare API
            Token，也不提供任意查询代理。日志保留期遵循平台配置。
          </p>
        </section>
      )}
    </>
  );
}
