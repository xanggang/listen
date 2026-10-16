import type { ReactNode } from 'react';
import { Alert, Button, Empty, Flex, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

/**
 * 页面标题统一展示业务说明和主要操作，窄屏允许操作区自然换行。
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
    <Flex
      className="page-header"
      justify="space-between"
      align="center"
      gap={16}
      wrap
    >
      <div>
        <Typography.Title level={3}>{title}</Typography.Title>
        <Typography.Text type="secondary">{description}</Typography.Text>
      </div>
      {action}
    </Flex>
  );
}

/**
 * 请求失败保留原始安全错误和重试入口；加载态与空态交给列表组件处理。
 */
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  empty?: boolean;
  retry: () => void;
}) {
  return !loading && error ? (
    <Alert
      className="section-notice"
      type="error"
      showIcon
      title="数据加载失败"
      description={error}
      action={
        <Button size="small" onClick={retry}>
          重试
        </Button>
      }
    />
  ) : null;
}

/**
 * 业务反馈保留在页面中；保存失败必须显式传 error，避免误报成功。
 */
export function Notice({
  message,
  type = 'info',
}: {
  message: string;
  type?: 'info' | 'success' | 'error';
}) {
  return message ? (
    <Alert
      className="section-notice"
      role={type === 'error' ? 'alert' : 'status'}
      type={type}
      showIcon
      title={message}
    />
  ) : null;
}

/**
 * 固定业务状态映射为语义标签，未知状态保留原值方便排查。
 */
export function Status({ value }: { value: string }) {
  const states: Record<string, { label: string; color?: string }> = {
    visible: { label: '已上架', color: 'success' },
    hidden: { label: '已下架' },
    active: { label: '可用', color: 'success' },
    unverified: { label: '未验证', color: 'warning' },
    unavailable: { label: '不可用', color: 'error' },
    open: { label: '待处理', color: 'processing' },
    resolved: { label: '已解决', color: 'success' },
    ignored: { label: '已忽略' },
  };
  return (
    <Tag color={states[value]?.color}>{states[value]?.label ?? value}</Tag>
  );
}

/**
 * 服务端分页表格固定每页 20 条，查询中显示 loading，失败不会伪装为空数据。
 */
export function DataTable<T extends { id: string }>({
  resource,
  columns,
  page,
  onChange,
}: {
  resource: {
    data?: { list: T[]; total: number };
    loading: boolean;
    error: string;
    refresh: () => void;
  };
  columns: TableProps<T>['columns'];
  page: number;
  onChange: (page: number) => void;
}) {
  return (
    <>
      <ResourceState {...resource} retry={resource.refresh} />
      <Table<T>
        rowKey="id"
        columns={columns}
        dataSource={resource.data?.list ?? []}
        loading={resource.loading}
        scroll={{ x: 850 }}
        locale={{
          emptyText: resource.error ? (
            '加载失败，请重试'
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无符合条件的数据"
            />
          ),
        }}
        pagination={{
          current: page,
          pageSize: 20,
          total: resource.data?.total ?? 0,
          showSizeChanger: false,
          showQuickJumper: true,
          hideOnSinglePage: false,
          // 总数来自服务端，不能用当前页记录数代替。
          showTotal: (total) => `共 ${total.toLocaleString()} 条`,
          onChange,
        }}
      />
    </>
  );
}

/**
 * 通用刷新操作保留当前查询条件，加载期间防止重复点击。
 */
export function RefreshButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button icon={<ReloadOutlined />} loading={loading} onClick={onClick}>
      刷新
    </Button>
  );
}
