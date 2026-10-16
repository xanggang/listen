import { useState } from 'react';
import {
  Alert,
  Card,
  Col,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  BarChartOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { Analytics, Overview } from '../lib/contracts';
import { useResource } from '../lib/hooks';
import { PageHeader, RefreshButton, ResourceState } from '../components/common';

/**
 * 总览与分析共享 UTC 真实统计；范围最多 31 天，UV 与 MAU 始终按平台独立展示。
 */
export function AnalyticsPage({ overview = false }: { overview?: boolean }) {
  const [days, setDays] = useState(7);
  const [source, setSource] = useState('');
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.parse(to) - (days - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  const query = new URLSearchParams({
    from,
    to,
    ...(source ? { source } : {}),
  });
  const resource = useResource<Overview>(
    `/admin/api/analytics${overview ? '/overview' : ''}?${query}`,
  );
  const { data } = resource;
  // PV 可跨日相加，匿名 UV 不累计为总用户数。
  const pv = data?.daily.reduce((total, row) => total + row.pv, 0) ?? 0;
  // 目录分组互斥，可以汇总为真实电台总数。
  const stations =
    data?.catalog?.reduce((total, row) => total + row.count, 0) ?? 0;
  const visible =
    data?.catalog?.reduce(
      // 上架数量不等同于播放可用数量。
      (total, row) => total + (row.visibility === 'visible' ? row.count : 0),
      0,
    ) ?? 0;
  return (
    <>
      <PageHeader
        title={overview ? '工作台' : '访问分析'}
        description={
          overview
            ? '查看电台内容概况与近期访问表现'
            : '按日期与平台查看匿名访问数据，了解实际使用情况'
        }
        action={
          <RefreshButton
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
      />
      <Card className="filter-card">
        <Space wrap size="large">
          <Space>
            <Typography.Text type="secondary">时间范围</Typography.Text>
            <Select
              aria-label="时间范围"
              value={days}
              options={[
                { value: 7, label: '最近 7 天' },
                { value: 14, label: '最近 14 天' },
                { value: 31, label: '最近 31 天' },
              ]}
              onChange={setDays}
            />
          </Space>
          <Space>
            <Typography.Text type="secondary">平台</Typography.Text>
            <Select
              aria-label="统计平台"
              className="status-filter"
              value={source}
              options={[
                { value: '', label: '全部平台' },
                { value: 'web', label: 'Web' },
                { value: 'android', label: 'Android' },
              ]}
              onChange={setSource}
            />
          </Space>
          <Typography.Text type="secondary">
            {from} 至 {to} · UTC
          </Typography.Text>
        </Space>
      </Card>
      <ResourceState {...resource} retry={resource.refresh} />
      {!resource.error && (
        <Row gutter={[16, 16]} className="metric-row">
          <Col xs={24} md={overview ? 8 : 24}>
            <Metric
              title="页面访问 PV"
              value={pv}
              note={`最近 ${days} 天有效页面访问`}
              icon={<BarChartOutlined />}
              loading={resource.loading}
            />
          </Col>
          {overview && (
            <>
              <Col xs={24} md={8}>
                <Metric
                  title="电台总数"
                  value={stations}
                  note="包含已下架及未验证电台"
                  icon={<GlobalOutlined />}
                  loading={resource.loading}
                />
              </Col>
              <Col xs={24} md={8}>
                <Metric
                  title="已上架电台"
                  value={visible}
                  note="可见数量，播放可用性由目录与流共同决定"
                  icon={<CheckCircleOutlined />}
                  loading={resource.loading}
                />
              </Col>
            </>
          )}
        </Row>
      )}
      {data && <MetricsTables data={data} />}
    </>
  );
}

/**
 * 指标卡在真实数据返回前展示骨架，不使用演示数字或加载中的零值。
 */
function Metric({
  title,
  value,
  note,
  icon,
  loading,
}: {
  title: string;
  value: number;
  note: string;
  icon: ReactNode;
  loading: boolean;
}) {
  return (
    <Card loading={loading}>
      <Statistic
        title={
          <Space>
            {icon}
            {title}
          </Space>
        }
        value={value}
      />
      <Typography.Paragraph type="secondary" className="metric-note">
        {note}
      </Typography.Paragraph>
    </Card>
  );
}

/**
 * 日 UV 与月 MAU 使用服务端去重结果；本地表格分页只影响呈现，不改变统计口径。
 */
function MetricsTables({ data }: { data: Analytics }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={14}>
        <Card title="每日访问" extra={<Tag>PV / 日 UV</Tag>}>
          <Table<Analytics['daily'][number]>
            size="middle"
            dataSource={data.daily}
            rowKey={
              // 平台和日期共同组成独立统计行。
              (row) => `${row.day}-${row.source}`
            }
            scroll={{ x: 460 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              hideOnSinglePage: true,
            }}
            columns={[
              { title: '日期 UTC', dataIndex: 'day' },
              { title: '平台', dataIndex: 'source' },
              { title: 'PV', dataIndex: 'pv', align: 'right' },
              { title: 'UV', dataIndex: 'uv', align: 'right' },
            ]}
          />
        </Card>
      </Col>
      <Col xs={24} xl={10}>
        <Card title="月活跃访客" extra={<Tag>MAU</Tag>}>
          <Table<Analytics['monthly'][number]>
            size="middle"
            dataSource={data.monthly}
            rowKey={
              // 月度匿名标识不跨平台合并。
              (row) => `${row.month}-${row.source}`
            }
            scroll={{ x: 360 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              hideOnSinglePage: true,
            }}
            columns={[
              { title: '月份', dataIndex: 'month' },
              { title: '平台', dataIndex: 'source' },
              { title: 'MAU', dataIndex: 'mau', align: 'right' },
            ]}
          />
          <Alert
            className="analytics-note"
            type="info"
            showIcon
            title="统计口径"
            description="Web 与 Android 独立计数。本月为截至当前的累计月活；日 UV 不可相加作为总用户数。"
          />
        </Card>
      </Col>
    </Row>
  );
}
