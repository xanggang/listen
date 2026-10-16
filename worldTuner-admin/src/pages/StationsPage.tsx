import { useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import type { Page, Station, StationDetail, Stream } from '../lib/contracts';
import { useDebounced, useResource } from '../lib/hooks';
import { apiRequest, save, errorMessage } from '../lib/api';
import { CatalogFilter } from '../components/CatalogFilter';
import {
  DataTable,
  Notice,
  PageHeader,
  RefreshButton,
  Status,
} from '../components/common';

const statusOptions = [
  { value: 'active', label: '可用' },
  { value: 'unverified', label: '未验证' },
  { value: 'unavailable', label: '不可用' },
];

/**
 * 电台管理使用服务端筛选和分页，详情重新读取最新版本，viewer 仅允许查看。
 */
export function StationsPage({ writable }: { writable: boolean }) {
  const [q, setQ] = useState('');
  const keyword = useDebounced(q);
  const [page, setPage] = useState(1);
  const [visibility, setVisibility] = useState('');
  const [status, setStatus] = useState('');
  const [countryId, setCountryId] = useState('');
  const [languageId, setLanguageId] = useState('');
  const [tagId, setTagId] = useState('');
  const [detail, setDetail] = useState<StationDetail>();
  const [editorRevision, setEditorRevision] = useState(0);
  const [notice, setNotice] = useState<{
    text: string;
    type: 'success' | 'error';
  }>();
  const [opening, setOpening] = useState<string>();
  const params = new URLSearchParams({ page: String(page), q: keyword });
  for (const [key, value] of Object.entries({
    visibility,
    status,
    countryId,
    languageId,
    tagId,
  }))
    if (value) params.set(key, value);
  const resource = useResource<Page<Station>>(`/admin/api/stations?${params}`);
  /**
   * 打开前重新读取详情，避免使用列表中的旧版本提交写入。
   */
  async function open(id: string) {
    setOpening(id);
    setNotice(undefined);
    try {
      setDetail(await apiRequest<StationDetail>(`/admin/api/stations/${id}`));
    } catch (error) {
      setNotice({ text: errorMessage(error), type: 'error' });
    } finally {
      setOpening(undefined);
    }
  }
  /**
   * 写入成功刷新列表并使用服务端新版本重建编辑器，公开端缓存提示保留可见。
   */
  function updated(value: StationDetail) {
    setDetail(value);
    resource.refresh();
    setNotice({
      type: 'success',
      text: '已保存。公开列表与详情缓存最长 60 秒，地图按配置 TTL 更新；App 已加载的页面需重新进入或重启。',
    });
  }
  /**
   * 清空所有筛选并返回第一页，保持远程字典关联值一致。
   */
  function reset() {
    setQ('');
    setVisibility('');
    setStatus('');
    setCountryId('');
    setLanguageId('');
    setTagId('');
    setPage(1);
  }
  const columns: TableProps<Station>['columns'] = [
    {
      title: '电台名称 / ID',
      dataIndex: 'name',
      width: 240,
      // 仅展示 public_id；不自动加载外部图标 URL。
      render: (_, station) => (
        <>
          <Typography.Text strong>{station.name}</Typography.Text>
          <div className="secondary-line mono">{station.id}</div>
        </>
      ),
    },
    {
      title: '国家 / 地区',
      dataIndex: 'country',
      width: 150,
      // 缺失地理信息保持明确占位。
      render: (_, station) => (
        <>
          {station.country ?? '—'}
          <div className="secondary-line">{station.place ?? '—'}</div>
        </>
      ),
    },
    {
      title: '上架状态',
      dataIndex: 'visibility',
      width: 110,
      // 可见性与流可用性分列，避免混淆。
      render: (value: string) => <Status value={value} />,
    },
    {
      title: '目录状态',
      dataIndex: 'status',
      width: 110,
      // 状态标签保留所有后端枚举。
      render: (value: string) => <Status value={value} />,
    },
    { title: '来源', dataIndex: 'source', width: 100 },
    { title: '更新时间 UTC', dataIndex: 'updatedAt', width: 190 },
    {
      title: '操作',
      fixed: 'right',
      width: 110,
      // 单次只打开一个详情，其他行暂时禁用，防止慢请求覆盖。
      render: (_, station) => (
        <Button
          type="link"
          loading={opening === station.id}
          disabled={Boolean(opening) && opening !== station.id}
          onClick={
            // 只读账号仍可读取电台和播放流。
            () => void open(station.id)
          }
        >
          {writable ? '查看 / 编辑' : '查看详情'}
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="电台管理"
        description="管理电台目录、基本信息和播放流，维护内容上下架状态"
        action={
          <RefreshButton
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
      />
      <Notice message={notice?.text ?? ''} type={notice?.type} />
      <Card className="filter-card">
        <div className="filter-grid">
          <div className="filter-field">
            <Typography.Text type="secondary">查找电台</Typography.Text>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              aria-label="查找电台"
              placeholder="电台名称或 7 位 ID"
              value={q}
              onChange={
                // 搜索防抖后查询完整目录，并从第一页开始。
                (event) => {
                  setQ(event.target.value);
                  setPage(1);
                }
              }
            />
          </div>
          <div className="filter-field">
            <Typography.Text type="secondary">上架状态</Typography.Text>
            <Select
              aria-label="上架状态"
              value={visibility}
              options={[
                { value: '', label: '全部状态' },
                { value: 'visible', label: '已上架' },
                { value: 'hidden', label: '已下架' },
              ]}
              onChange={
                // 可独立查询隐藏电台以重新上架。
                (value) => {
                  setVisibility(value);
                  setPage(1);
                }
              }
            />
          </div>
          <div className="filter-field">
            <Typography.Text type="secondary">目录状态</Typography.Text>
            <Select
              aria-label="目录状态"
              value={status}
              options={[{ value: '', label: '全部状态' }, ...statusOptions]}
              onChange={
                // 目录状态筛选独立于可见性。
                (value) => {
                  setStatus(value);
                  setPage(1);
                }
              }
            />
          </div>
          <Flex align="end">
            <Button onClick={reset}>重置筛选</Button>
          </Flex>
        </div>
        <Collapse
          ghost
          items={[
            {
              key: 'advanced',
              label: '更多筛选：国家 / 地区、语言、标签',
              children: (
                <div className="filter-grid">
                  <CatalogFilter
                    kind="countries"
                    label="国家 / 地区"
                    value={countryId}
                    onChange={
                      // 按稳定国家 ID 筛选。
                      (id) => {
                        setCountryId(id);
                        setPage(1);
                      }
                    }
                  />
                  <CatalogFilter
                    kind="languages"
                    label="语言"
                    value={languageId}
                    onChange={
                      // 语言变化重置分页。
                      (id) => {
                        setLanguageId(id);
                        setPage(1);
                      }
                    }
                  />
                  <CatalogFilter
                    kind="tags"
                    label="标签"
                    value={tagId}
                    onChange={
                      // 标签变化重置分页。
                      (id) => {
                        setTagId(id);
                        setPage(1);
                      }
                    }
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Card
        title="电台列表"
        extra={
          <Typography.Text type="secondary">
            {resource.data
              ? `共 ${resource.data.total.toLocaleString()} 个电台`
              : '完整目录'}
          </Typography.Text>
        }
      >
        <DataTable
          resource={resource}
          columns={columns}
          page={page}
          onChange={setPage}
        />
      </Card>
      {detail && (
        <StationEditor
          key={`${detail.id}-${detail.updatedAt}-${editorRevision}`}
          station={detail}
          writable={writable}
          onSaved={updated}
          onReload={
            // 即使服务端版本未变，重新加载也应清除用户确认放弃的草稿。
            (value) => {
              setDetail(value);
              setEditorRevision(editorRevision + 1);
            }
          }
          onClose={
            // 关闭前由编辑器检查尚未保存的输入。
            () => setDetail(undefined)
          }
        />
      )}
    </>
  );
}

/**
 * 电台抽屉以乐观锁版本保存，切换编辑对象和关闭前确认放弃输入，失败保留表单。
 */
function StationEditor({
  station,
  writable,
  onSaved,
  onReload,
  onClose,
}: {
  station: StationDetail;
  writable: boolean;
  onSaved: (station: StationDetail) => void;
  onReload: (station: StationDetail) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('basic');
  const [streamId, setStreamId] = useState(station.streams[0]?.id);
  const { modal } = App.useApp();
  /**
   * 未保存输入时使用受主题控制的确认框；请求进行中不允许离开当前编辑器。
   */
  function leave(action: () => void) {
    if (busy) return;
    if (!dirty) {
      action();
      return;
    }
    modal.confirm({
      title: '放弃未保存的修改？',
      content: '当前输入尚未保存，继续后将丢失这些修改。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      onOk: action,
    });
  }
  /**
   * 重新取回服务端最新版本，冲突恢复不自动重放写入。
   */
  async function reload() {
    setBusy(true);
    setError('');
    try {
      onReload(
        await apiRequest<StationDetail>(`/admin/api/stations/${station.id}`),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  /**
   * 上下架独立提交；保留版本检查，成功后使用服务器结果刷新。
   */
  async function toggleVisibility() {
    setBusy(true);
    setError('');
    try {
      onSaved(
        await save<StationDetail>(
          `/admin/api/stations/${station.id}/visibility`,
          {
            expectedUpdatedAt: station.updatedAt,
            visibility: station.visibility === 'visible' ? 'hidden' : 'visible',
          },
        ),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  /**
   * 标记用户输入，程序初始化值不会触发此回调。
   */
  function changed() {
    setDirty(true);
  }
  // 仅挂载一个播放流编辑表单，避免保存某个流时丢弃其他流的草稿。
  const stream = station.streams.find((item) => item.id === streamId);
  return (
    <Drawer
      open
      title={writable ? '电台详情与编辑' : '电台详情'}
      size={760}
      mask={{ closable: false }}
      keyboard={!busy}
      closable={!busy}
      onClose={
        // 显式关闭也必须确认未保存内容。
        () => leave(onClose)
      }
      footer={
        <Flex justify="space-between" align="center" gap={12} wrap>
          <Typography.Text type="secondary">
            {dirty ? '有未保存的修改' : '已加载服务器版本'}
          </Typography.Text>
          <Space>
            <Button
              disabled={busy}
              onClick={
                // 重载会丢弃输入，先执行相同的离开确认。
                () =>
                  leave(
                    // 确认后才获取最新版本。
                    () => void reload(),
                  )
              }
            >
              重新加载
            </Button>
            <Button
              disabled={busy}
              onClick={
                // 取消编辑不写入服务器。
                () => leave(onClose)
              }
            >
              关闭
            </Button>
            {writable && (
              <Button
                type="primary"
                loading={busy}
                htmlType="submit"
                form={tab === 'basic' ? 'station-form' : 'stream-form'}
                disabled={tab === 'streams' && !stream}
              >
                保存{tab === 'basic' ? '基本信息' : '播放流'}
              </Button>
            )}
          </Space>
        </Flex>
      }
    >
      <Flex
        align="start"
        justify="space-between"
        gap={16}
        wrap
        className="detail-heading"
      >
        <div>
          <Typography.Title level={4}>{station.name}</Typography.Title>
          <Typography.Text type="secondary" copyable>
            {station.id}
          </Typography.Text>
        </div>
        <Space>
          <Status value={station.visibility} />
          <Status value={station.status} />
        </Space>
      </Flex>
      <Notice message={error} type="error" />
      <Descriptions
        size="small"
        column={2}
        items={[
          { key: 'source', label: '数据来源', children: station.source },
          {
            key: 'updated',
            label: '更新时间 UTC',
            children: station.updatedAt,
          },
        ]}
      />
      {writable && (
        <div className="visibility-action">
          <Popconfirm
            title={
              station.visibility === 'visible'
                ? '确认下架这个电台？'
                : '确认上架这个电台？'
            }
            description={
              dirty
                ? '当前还有未保存的表单修改，请先保存或重新加载。'
                : '此操作将更新电台在公开目录中的可见性。'
            }
            disabled={busy || dirty}
            onConfirm={toggleVisibility}
            okText="确认"
            cancelText="取消"
          >
            <Button
              danger={station.visibility === 'visible'}
              disabled={busy || dirty}
            >
              {station.visibility === 'visible' ? '下架电台' : '上架电台'}
            </Button>
          </Popconfirm>
        </div>
      )}
      <Tabs
        activeKey={tab}
        onChange={
          // 切换编辑区需要确认丢弃当前草稿。
          (key) =>
            leave(
              // 卸载当前表单并清除草稿标记。
              () => {
                setTab(key);
                setDirty(false);
                setError('');
              },
            )
        }
        items={[
          { key: 'basic', label: '基本信息' },
          { key: 'streams', label: `播放流 (${station.streams.length})` },
        ]}
      />
      {tab === 'basic' ? (
        <StationForm
          station={station}
          disabled={!writable || busy}
          onSaved={onSaved}
          onBusy={setBusy}
          onError={setError}
          onChanged={changed}
        />
      ) : (
        <>
          <div className="stream-selector">
            <Select
              aria-label="选择播放流"
              value={streamId}
              placeholder="暂无播放流"
              disabled={busy}
              options={station.streams.map(
                // 主流标记只读，不在本次编辑中改变。
                (item) => ({
                  value: item.id,
                  label: `${item.isPrimary ? '主播放流' : '备用流'} · ${item.codec ?? '未知编码'} · ${item.id}`,
                }),
              )}
              onChange={
                // 同一时间只编辑一个流，切换前保留放弃确认。
                (id) =>
                  leave(
                    // 已确认放弃旧流草稿。
                    () => {
                      setStreamId(id);
                      setDirty(false);
                      setError('');
                    },
                  )
              }
            />
          </div>
          {stream ? (
            <StreamForm
              key={stream.id}
              station={station}
              stream={stream}
              disabled={!writable || busy}
              onSaved={onSaved}
              onBusy={setBusy}
              onError={setError}
              onChanged={changed}
            />
          ) : (
            <Notice message="这个电台尚无播放流。" />
          )}
        </>
      )}
    </Drawer>
  );
}

type EditorCallbacks = {
  disabled: boolean;
  onSaved: (station: StationDetail) => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  onChanged: () => void;
};
type StationValues = Pick<
  StationDetail,
  'name' | 'status' | 'place' | 'website' | 'favicon' | 'latitude' | 'longitude'
>;

/**
 * 基本信息使用表单字段校验，坐标必须成对提供；写入仍由 API 检查约束与版本。
 */
function StationForm({
  station,
  disabled,
  onSaved,
  onBusy,
  onError,
  onChanged,
}: { station: StationDetail } & EditorCallbacks) {
  const [countryId, setCountryId] = useState(station.countryId ?? '');
  /**
   * 表单验证通过才提交；失败保留输入并显示安全错误与请求 ID。
   */
  async function submit(values: StationValues) {
    if ((values.latitude == null) !== (values.longitude == null)) {
      onError('经度和纬度必须同时填写或同时清空。');
      return;
    }
    onBusy(true);
    onError('');
    try {
      onSaved(
        await save<StationDetail>(`/admin/api/stations/${station.id}`, {
          ...values,
          expectedUpdatedAt: station.updatedAt,
          countryId: countryId || null,
          place: values.place || null,
          website: values.website || null,
          favicon: values.favicon || null,
          latitude: values.latitude ?? null,
          longitude: values.longitude ?? null,
        }),
      );
    } catch (reason) {
      onError(errorMessage(reason));
    } finally {
      onBusy(false);
    }
  }
  return (
    <Form
      id="station-form"
      layout="vertical"
      disabled={disabled}
      initialValues={station}
      onFinish={submit}
      onValuesChange={onChanged}
    >
      <Row gutter={20}>
        <Col xs={24} sm={16}>
          <Form.Item
            name="name"
            label="电台名称"
            rules={[
              {
                required: true,
                whitespace: true,
                max: 200,
                message: '请输入 1–200 个字符的电台名称',
              },
            ]}
          >
            <Input maxLength={200} showCount />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            name="status"
            label="目录状态"
            rules={[{ required: true }]}
          >
            <Select options={statusOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label={`国家 / 地区（${station.country ?? '未设置'}）`}>
            <CatalogFilter
              kind="countries"
              label="国家 / 地区"
              value={countryId}
              disabled={disabled}
              onChange={
                // 远程关联字段不由 Form 管理，显式标记草稿变化。
                (id) => {
                  setCountryId(id);
                  onChanged();
                }
              }
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="place" label="地区 / 城市" rules={[{ max: 200 }]}>
            <Input maxLength={200} />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item
            name="website"
            label="网站地址"
            rules={[
              { type: 'url', message: '请输入完整的网站 URL' },
              { max: 2048 },
            ]}
          >
            <Input placeholder="https://" maxLength={2048} />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item
            name="favicon"
            label="图标地址"
            extra="仅保存地址，不自动加载外部图片。"
            rules={[
              { type: 'url', message: '请输入完整的图标 URL' },
              { max: 2048 },
            ]}
          >
            <Input placeholder="https://" maxLength={2048} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="latitude"
            label="纬度"
            rules={[{ type: 'number', min: -90, max: 90 }]}
          >
            <InputNumber
              min={-90}
              max={90}
              placeholder="-90 至 90"
              className="full-width"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="longitude"
            label="经度"
            rules={[{ type: 'number', min: -180, max: 180 }]}
          >
            <InputNumber
              min={-180}
              max={180}
              placeholder="-180 至 180"
              className="full-width"
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}

type StreamValues = {
  url: string;
  resolvedUrl: string | null;
  codec: string | null;
  bitrate: number | null;
  isHls: boolean;
};
/**
 * 播放流只编辑允许字段；ID、归属和主流标记保持只读，保存携带父电台版本。
 */
function StreamForm({
  station,
  stream,
  disabled,
  onSaved,
  onBusy,
  onError,
  onChanged,
}: { station: StationDetail; stream: Stream } & EditorCallbacks) {
  /**
   * 独立保存当前播放流，空可选值显式提交 null，不自动重试冲突写入。
   */
  async function submit(values: StreamValues) {
    onBusy(true);
    onError('');
    try {
      onSaved(
        await save<StationDetail>(
          `/admin/api/stations/${station.id}/streams/${stream.id}`,
          {
            ...values,
            expectedUpdatedAt: station.updatedAt,
            resolvedUrl: values.resolvedUrl || null,
            codec: values.codec || null,
            bitrate: values.bitrate ?? null,
          },
        ),
      );
    } catch (reason) {
      onError(errorMessage(reason));
    } finally {
      onBusy(false);
    }
  }
  return (
    <Form
      id="stream-form"
      layout="vertical"
      disabled={disabled}
      initialValues={{ ...stream, isHls: stream.isHls === 1 }}
      onFinish={submit}
      onValuesChange={onChanged}
    >
      <Space className="section-notice">
        <Tag>{stream.isPrimary ? '主播放流' : '备用流'}</Tag>
        <Typography.Text type="secondary">{stream.id}</Typography.Text>
      </Space>
      <Form.Item
        name="url"
        label="原始 URL"
        rules={[{ required: true, whitespace: true, max: 2048 }]}
      >
        <Input maxLength={2048} />
      </Form.Item>
      <Form.Item name="resolvedUrl" label="解析 URL" rules={[{ max: 2048 }]}>
        <Input maxLength={2048} />
      </Form.Item>
      <Row gutter={20}>
        <Col span={12}>
          <Form.Item name="codec" label="编码" rules={[{ max: 40 }]}>
            <Input maxLength={40} placeholder="例如 MP3、AAC" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="bitrate"
            label="比特率 (kbps)"
            rules={[{ type: 'integer', min: 0, max: 100000 }]}
          >
            <InputNumber
              min={0}
              max={100000}
              precision={0}
              className="full-width"
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="isHls" label="HLS 播放流" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
}
