import { useEffect, useState } from 'react';
import {
  App as AntApp,
  Avatar,
  Breadcrumb,
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Flex,
  Grid,
  Layout,
  Menu,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {
  BarChartOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SunOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { Session } from './lib/contracts';
import { loadSession, errorMessage } from './lib/api';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { StationsPage } from './pages/StationsPage';
import { CatalogPage } from './pages/CatalogPage';
import { ReportsPage, AuditPage, LogsPage } from './pages/OperationsPages';
import { Notice } from './components/common';

const navigation = [
  { key: 'overview', label: '工作台', icon: <DashboardOutlined /> },
  { key: 'stations', label: '电台管理', icon: <GlobalOutlined /> },
  { key: 'catalog', label: '分类与译名', icon: <DatabaseOutlined /> },
  { key: 'analytics', label: '访问分析', icon: <BarChartOutlined /> },
  { key: 'reports', label: '错误报告', icon: <WarningOutlined /> },
  { key: 'audit', label: '操作审计', icon: <FileSearchOutlined /> },
  { key: 'logs', label: '运行日志', icon: <UnorderedListOutlined /> },
];

/**
 * 只接受已注册的 hash 页面，支持刷新、书签和浏览器前进后退。
 */
function currentPage() {
  const key = location.hash.slice(1);
  // 未知地址安全回退到工作台。
  return navigation.some((item) => item.key === key) ? key : 'overview';
}

/**
 * 管理应用统一配置中文和亮暗主题，认证信息仅保留在内存。
 */
export function App() {
  const [dark, setDark] = useState(false);
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        },
      }}
    >
      <AntApp>
        <AdminWorkspace dark={dark} onThemeChange={setDark} />
      </AntApp>
    </ConfigProvider>
  );
}

/**
 * 组装响应式导航和权限视图；本地自动连接，生产提供 Access 会话退出入口。
 */
function AdminWorkspace({
  dark,
  onThemeChange,
}: {
  dark: boolean;
  onThemeChange: (dark: boolean) => void;
}) {
  const [session, setSession] = useState<Session>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(currentPage);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const desktop = Boolean(screens.lg);
  /**
   * 每次连接从服务端读取当前管理员身份和权限；本地无需输入认证凭据。
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
    // 初次进入验证会话，生产认证由 Access 完成。
    () => {
      void connect();
    },
    [],
  );
  useEffect(
    // 跟随浏览器历史切换页面，同时关闭移动端导航。
    () => {
      // hash 只用于本地导航，不拼入 API 请求。
      function syncPage() {
        setPage(currentPage());
        setMobileOpen(false);
      }
      window.addEventListener('hashchange', syncPage);
      return () => window.removeEventListener('hashchange', syncPage);
    },
    [],
  );
  /**
   * 结束生产 Access 会话；本地自动连接模式不显示退出入口。
   */
  function logout() {
    if (session?.authMode === 'access')
      location.assign('/cdn-cgi/access/logout');
  }
  const title =
    navigation.find(
      // 当前页面标题来自固定菜单，不接受任意 hash 文案。
      (item) => item.key === page,
    )?.label ?? '工作台';
  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[page]}
      items={navigation}
      onClick={
        // 使用 hash 保留浏览器历史，重复选择也关闭移动导航。
        ({ key }) => {
          location.hash = key;
          setMobileOpen(false);
        }
      }
    />
  );
  if (!session)
    return (
      <div className="login-page" style={{ background: token.colorBgLayout }}>
        <Card className="login-card">
          <Flex vertical align="center" gap={12} className="login-brand">
            <img src="/worldtuner-logo.svg" alt="" width="48" height="48" />
            <Typography.Title level={3}>WorldTuner 管理中心</Typography.Title>
            <Typography.Text type="secondary">连接管理工作空间</Typography.Text>
          </Flex>
          {loading ? (
            <div className="login-loading">
              <Space orientation="vertical">
                <Spin />
                <Typography.Text type="secondary">
                  正在连接管理服务…
                </Typography.Text>
              </Space>
            </div>
          ) : (
            <>
              <Notice message={error} type="error" />
              {['localhost', '127.0.0.1', '[::1]'].includes(
                location.hostname,
              ) ? (
                <Space orientation="vertical">
                  <Typography.Paragraph>
                    本地开发无需登录，请确认管理 API 已启动后重新连接。
                  </Typography.Paragraph>
                  <Button type="primary" onClick={connect}>
                    重新连接
                  </Button>
                </Space>
              ) : (
                <Space orientation="vertical">
                  <Typography.Paragraph>
                    请通过管理域名的 Cloudflare Access 完成身份验证。
                  </Typography.Paragraph>
                  <Button type="primary" onClick={connect}>
                    重新验证
                  </Button>
                </Space>
              )}
            </>
          )}
        </Card>
      </div>
    );
  const writable = session.role === 'owner';
  return (
    <Layout className="admin-layout">
      {desktop && (
        <Layout.Sider
          width={224}
          collapsed={collapsed}
          theme={dark ? 'dark' : 'light'}
          className="admin-sider"
          style={{ borderInlineEnd: `1px solid ${token.colorBorderSecondary}` }}
        >
          <a className="brand" href="#overview">
            <img src="/worldtuner-logo.svg" alt="" width="32" height="32" />
            {!collapsed && (
              <strong>
                WorldTuner <span>ADMIN</span>
              </strong>
            )}
          </a>
          {menu}
          {!collapsed && (
            <div className="sider-caption">
              <Typography.Text type="secondary">
                电台内容与运营管理
              </Typography.Text>
            </div>
          )}
        </Layout.Sider>
      )}
      <Drawer
        title="WorldTuner"
        placement="left"
        open={!desktop && mobileOpen}
        size={256}
        onClose={
          // 移动端抽屉关闭不改变当前业务页面。
          () => setMobileOpen(false)
        }
      >
        {menu}
      </Drawer>
      <Layout>
        <Layout.Header
          className="admin-header"
          style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Flex align="center" gap={16}>
            <Button
              type="text"
              aria-label={desktop ? '折叠导航' : '打开导航'}
              icon={
                collapsed || !desktop ? (
                  <MenuUnfoldOutlined />
                ) : (
                  <MenuFoldOutlined />
                )
              }
              onClick={
                // 大屏折叠侧栏，窄屏打开覆盖导航。
                () => (desktop ? setCollapsed(!collapsed) : setMobileOpen(true))
              }
            />
            <Breadcrumb items={[{ title: '管理中心' }, { title }]} />
          </Flex>
          <Space size="middle">
            <Tag color={session.authMode === 'local' ? 'orange' : 'success'}>
              {session.authMode === 'local' ? '本地环境' : 'Access 已验证'}
            </Tag>
            <Tooltip title={dark ? '切换浅色主题' : '切换深色主题'}>
              <Button
                type="text"
                aria-label="切换深浅色主题"
                icon={dark ? <SunOutlined /> : <MoonOutlined />}
                onClick={
                  // 主题只影响管理界面，通过 ConfigProvider 同步浮层。
                  () => onThemeChange(!dark)
                }
              />
            </Tooltip>
            <Tooltip
              title={`${session.email} · ${writable ? '所有者' : '只读管理员'}`}
            >
              <Avatar className="account-avatar">
                {session.email.slice(0, 1).toUpperCase()}
              </Avatar>
            </Tooltip>
            {session.authMode === 'access' && (
              <Popconfirm
                title="退出管理中心？"
                description="退出后需要重新验证身份。"
                onConfirm={logout}
                okText="退出"
                cancelText="取消"
              >
                <Button
                  type="text"
                  aria-label="退出登录"
                  icon={<LogoutOutlined />}
                />
              </Popconfirm>
            )}
          </Space>
        </Layout.Header>
        <Layout.Content className="admin-content">
          {!writable && (
            <Notice message="当前为只读权限，可查看数据；编辑操作需要所有者权限。" />
          )}
          {page === 'overview' && <AnalyticsPage overview />}
          {page === 'stations' && <StationsPage writable={writable} />}
          {page === 'catalog' && <CatalogPage writable={writable} />}
          {page === 'analytics' && <AnalyticsPage />}
          {page === 'reports' && <ReportsPage writable={writable} />}
          {page === 'audit' && <AuditPage />}
          {page === 'logs' && <LogsPage />}
        </Layout.Content>
        <Layout.Footer className="admin-footer">
          WorldTuner 管理中心 · 所有数据时间均为 UTC
        </Layout.Footer>
      </Layout>
    </Layout>
  );
}
