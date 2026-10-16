import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import type { Page, Report, Audit, Logs } from '../lib/contracts';
import { useResource } from '../lib/hooks';
import { save, errorMessage } from '../lib/api';
import {
  DataTable,
  Notice,
  PageHeader,
  RefreshButton,
  ResourceState,
  Status,
} from '../components/common';

const reportStatuses = [
  { value: 'open', label: '待处理' },
  { value: 'resolved', label: '已解决' },
  { value: 'ignored', label: '已忽略' },
];

/**
 * 错误报告只展示真实样本；处理状态以服务端旧状态做并发检查，失败不改变行数据。
 */
export function ReportsPage({ writable }: { writable: boolean }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState<{
    text: string;
    type: 'success' | 'error';
  }>();
  const [busy, setBusy] = useState<string>();
  const resource = useResource<Page<Report> & { ingestionEnabled: boolean }>(
    `/admin/api/reports?page=${page}${status ? `&status=${status}` : ''}`,
  );
  /**
   * 写入中禁用所有处理入口，避免对同一旧状态重复提交。
   */
  async function update(report: Report, value: string) {
    if (value === report.status) return;
    setBusy(report.id);
    setNotice(undefined);
    try {
      await save(`/admin/api/reports/${encodeURIComponent(report.id)}/status`, {
        status: value,
        expectedStatus: report.status,
      });
      setNotice({ type: 'success', text: '处理状态已保存' });
      resource.refresh();
    } catch (reason) {
      setNotice({ type: 'error', text: errorMessage(reason) });
    } finally {
      setBusy(undefined);
    }
  }
  const columns: TableProps<Report>['columns'] = [
    {
      title: '错误摘要',
      width: 320,
      // React 转义外部错误文本，不插入 HTML。
      render: (_, report) => (
        <>
          <Typography.Text strong>{report.errorCode}</Typography.Text>
          <div className="secondary-line">
            {report.eventType} · {report.message}
          </div>
          {report.requestId && (
            <Typography.Text type="secondary" copyable className="mono">
              {report.requestId}
            </Typography.Text>
          )}
        </>
      ),
    },
    {
      title: '平台 / 版本',
      width: 140,
      // 应用版本缺失时使用明确占位。
      render: (_, report) => (
        <>
          {report.platform}
          <div className="secondary-line">{report.appVersion || '—'}</div>
        </>
      ),
    },
    {
      title: '处理状态',
      dataIndex: 'status',
      width: 110,
      // 状态使用统一语义色。
      render: (value: string) => <Status value={value} />,
    },
    { title: '时间 UTC', dataIndex: 'createdAt', width: 190 },
    {
      title: '处理',
      width: 130,
      fixed: 'right',
      // viewer 不暴露写入口；选项只来自服务端支持的固定枚举。
      render: (_, report) =>
        writable ? (
          <Select
            aria-label={`处理 ${report.errorCode}`}
            value={report.status}
            disabled={Boolean(busy)}
            loading={busy === report.id}
            options={reportStatuses}
            className="full-width"
            onChange={
              // 等待保存成功后再展示服务端新状态。
              (value) => void update(report, value)
            }
          />
        ) : (
          <Typography.Text type="secondary">只读</Typography.Text>
        ),
    },
  ];
  return (
    <>
      <PageHeader
        title="错误报告"
        description="查看客户端错误摘要与处理进度，关联请求 ID 排查问题"
        action={
          <RefreshButton
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
      />
      <Notice message={notice?.text ?? ''} type={notice?.type} />
      {resource.data && !resource.data.ingestionEnabled && (
        <Alert
          className="section-notice"
          type="info"
          showIcon
          title="客户端错误上报尚未接入"
          description="这里展示运营库中已有的报告；接入上报后将展示真实错误样本。"
        />
      )}
      <Card
        title="报告列表"
        extra={
          <Space>
            <Typography.Text type="secondary">处理状态</Typography.Text>
            <Select
              aria-label="筛选处理状态"
              value={status}
              options={[{ value: '', label: '全部状态' }, ...reportStatuses]}
              className="status-filter"
              onChange={
                // 筛选变化重置到第一页。
                (value) => {
                  setStatus(value);
                  setPage(1);
                }
              }
            />
          </Space>
        }
      >
        <DataTable
          resource={resource}
          columns={columns}
          page={page}
          onChange={setPage}
        />
      </Card>
    </>
  );
}

/**
 * 审计只读展示服务端记录；请求 ID 支持复制，便于关联运行日志。
 */
export function AuditPage() {
  const [page, setPage] = useState(1);
  const resource = useResource<Page<Audit>>(`/admin/api/audit?page=${page}`);
  const columns: TableProps<Audit>['columns'] = [
    {
      title: '动作 / 实体',
      width: 240,
      // 稳定实体键与动作同时显示，避免仅显示内部动作代码。
      render: (_, row) => (
        <>
          <Tag>{row.action}</Tag>
          <div className="secondary-line mono">
            {row.entityType} / {row.entityId}
          </div>
        </>
      ),
    },
    { title: '管理员', dataIndex: 'actorId', width: 160 },
    {
      title: '变更字段',
      dataIndex: 'changedFields',
      width: 240,
      className: 'mono',
    },
    { title: '时间 UTC', dataIndex: 'createdAt', width: 190 },
    {
      title: '请求 ID',
      dataIndex: 'requestId',
      width: 260,
      // 复制仅包含安全请求标识，不包含凭据和请求正文。
      render: (value: string) => (
        <Typography.Text copyable className="mono">
          {value}
        </Typography.Text>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="操作审计"
        description="追踪管理员操作、变更字段与请求记录"
        action={
          <RefreshButton
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
      />
      <Card title="审计记录">
        <DataTable
          resource={resource}
          columns={columns}
          page={page}
          onChange={setPage}
        />
      </Card>
    </>
  );
}

/**
 * 日志页给出真实控制台入口与查询步骤，未实现的日志代理不伪装成空列表。
 */
export function LogsPage() {
  const resource = useResource<Logs>('/admin/api/logs');
  return (
    <>
      <PageHeader
        title="运行日志"
        description="在 Cloudflare Workers Logs 中查询服务端日志与请求记录"
        action={
          <RefreshButton
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
      />
      <ResourceState {...resource} retry={resource.refresh} />
      <Card loading={resource.loading} title="日志查询">
        {resource.data && (
          <>
            <Flex
              justify="space-between"
              align="center"
              gap={16}
              wrap
              className="table-toolbar"
            >
              <Space orientation="vertical">
                <Typography.Title level={4}>
                  Cloudflare Workers Logs
                </Typography.Title>
                <Typography.Text type="secondary">
                  {resource.data.message}
                </Typography.Text>
              </Space>
              <Button
                type="primary"
                icon={<ExportOutlined />}
                href={resource.data.consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                打开控制台
              </Button>
            </Flex>
            <Steps
              orientation="vertical"
              current={-1}
              items={[
                {
                  title: '选择 Worker',
                  content:
                    '进入 worldtuner-api 或 worldtuner-admin 的管理页面。',
                },
                {
                  title: '设置查询时间',
                  content:
                    '打开 Observability / Logs，设置故障发生时间附近的范围。',
                },
                {
                  title: '关联请求 ID',
                  content: '复制错误提示或审计记录中的请求 ID，检索对应日志。',
                },
              ]}
            />
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: 'mode',
                  label: '查询方式',
                  children: 'Cloudflare 原生控制台',
                },
                { key: 'status', label: '网页日志查询', children: '暂未开放' },
              ]}
            />
          </>
        )}
      </Card>
    </>
  );
}
