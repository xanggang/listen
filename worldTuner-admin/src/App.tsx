import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from './lib/contracts';
import { loadSession, setLocalToken, errorMessage } from './lib/api';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { StationsPage } from './pages/StationsPage';
import { CatalogPage } from './pages/CatalogPage';
import { ReportsPage, AuditPage, LogsPage } from './pages/OperationsPages';

const navigation = [
  ['overview', '工作台', '◉'],
  ['stations', '电台管理', '◈'],
  ['catalog', '分类与译名', '▦'],
  ['analytics', '访问分析', '▥'],
  ['reports', '错误报告', '△'],
  ['audit', '操作审计', '≡'],
  ['logs', '运行日志', '⌘'],
] as const;
type PageName = (typeof navigation)[number][0];

/**
 * 独立管理应用，只调用同源管理 Worker；生产身份交给 Access，本地密钥仅存在内存。
 */
export function App() {
  const [session, setSession] = useState<Session>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState<PageName>('overview');
  const [dark, setDark] = useState(false);
  /**
   * 页面首次进入或本地登录后重新验证身份，不从缓存恢复管理员权限。
   */
  async function connect() {
    setLoading(true);
    setError('');
    try {
      setSession(await loadSession());
    } catch (reason) {
      setSession(undefined);
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }
  useEffect(
    // 首次加载执行会话验证；没有向浏览器注入生产静态密钥。
    () => {
      void connect();
    },
    [],
  );
  useEffect(
    // 用根节点 data 属性切换主题，不触发内联样式 CSP 例外。
    () => {
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    },
    [dark],
  );
  /**
   * 开发环境表单仅在 loopback 页面出现，生产页面始终使用 Access 认证。
   */
  function localLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalToken(String(new FormData(event.currentTarget).get('token') ?? ''));
    void connect();
  }
  if (!session)
    return (
      <main className="login">
        <section className="login-card">
          <img src="/worldtuner-logo.svg" alt="" width="48" height="48" />
          <div className="eyebrow">WORLDTUNER ADMIN</div>
          <h1>管理中心</h1>
          <p>仅限已授权管理员访问</p>
          {loading ? (
            <div role="status">正在验证身份…</div>
          ) : (
            <>
              <p className="error" role="alert">
                {error}
              </p>
              {['localhost', '127.0.0.1', '[::1]'].includes(
                location.hostname,
              ) ? (
                <form onSubmit={localLogin}>
                  <label>
                    本地开发密钥
                    <input
                      name="token"
                      type="password"
                      required
                      minLength={32}
                      autoComplete="off"
                      placeholder="管理 API 的 .env.sqlite 中的 ADMIN_LOCAL_TOKEN"
                    />
                  </label>
                  <button className="primary" type="submit">
                    连接本地管理服务
                  </button>
                </form>
              ) : (
                <>
                  <p>
                    请通过配置了 Cloudflare Access
                    的管理域名登录。无权限时联系管理员授权。
                  </p>
                  <button
                    onClick={
                      // 身份供应商完成认证后重新载入服务器会话。
                      () => void connect()
                    }
                  >
                    重新验证
                  </button>
                </>
              )}
            </>
          )}
        </section>
      </main>
    );
  const writable = session.role === 'owner';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#">
          <img src="/worldtuner-logo.svg" alt="" width="38" height="38" />
          <div>
            <strong>WORLDTUNER</strong>
            <small>管理中心</small>
          </div>
        </a>
        <div className="nav-label">工作空间</div>
        <nav aria-label="管理功能">
          {navigation.map(
            // 页面之间保留独立模块，切换时重新加载对应资源。
            ([id, label, icon]) => (
              <button
                key={id}
                aria-current={page === id ? 'page' : undefined}
                className={page === id ? 'active' : ''}
                onClick={
                  // 只改变当前管理视图，不修改客户端路由或 API 配置。
                  () => setPage(id)
                }
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </button>
            ),
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">
            {session.email.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{session.email}</strong>
            <small>{writable ? '所有者' : '只读管理员'}</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>WorldTuner / 管理工作空间</span>
          <div>
            <span className="badge positive">
              {session.authMode === 'local' ? '本地环境' : 'Access 已验证'}
            </span>
            <button
              aria-label="切换深浅色主题"
              onClick={
                // 主题只影响本管理页面，不改变业务数据或客户端设置。
                () => setDark(!dark)
              }
            >
              {dark ? '日间模式' : '夜间模式'}
            </button>
            <button
              onClick={
                // 退出清除内存凭据；生产通过 Access 的标准退出入口结束会话。
                () => {
                  setLocalToken('');
                  setSession(undefined);
                  if (session.authMode === 'access')
                    location.assign('/cdn-cgi/access/logout');
                }
              }
            >
              退出
            </button>
          </div>
        </header>
        <main className="content">
          {page === 'overview' && <AnalyticsPage overview />}
          {page === 'stations' && <StationsPage writable={writable} />}{' '}
          {page === 'catalog' && <CatalogPage writable={writable} />}{' '}
          {page === 'analytics' && <AnalyticsPage />}
          {page === 'reports' && <ReportsPage writable={writable} />}{' '}
          {page === 'audit' && <AuditPage />}
          {page === 'logs' && <LogsPage />}
          <footer>WORLDTUNER · 业务与运营分库 · 所有时间为 UTC</footer>
        </main>
      </div>
    </div>
  );
}
