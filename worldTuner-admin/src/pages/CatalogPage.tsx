import { useState } from 'react';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Tabs,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { CatalogItem, CatalogKind, Page } from '../lib/contracts';
import { useDebounced, useResource } from '../lib/hooks';
import { save, errorMessage } from '../lib/api';
import {
  DataTable,
  Notice,
  PageHeader,
  RefreshButton,
} from '../components/common';

/**
 * 分类按业务标签页组织，译名编辑保持来源原名、代码及关联 ID 不变。
 */
export function CatalogPage({ writable }: { writable: boolean }) {
  const [kind, setKind] = useState<CatalogKind>('countries');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CatalogItem>();
  const [message, setMessage] = useState('');
  const keyword = useDebounced(q);
  const resource = useResource<Page<CatalogItem>>(
    `/admin/api/catalog/${kind}?page=${page}&q=${encodeURIComponent(keyword)}`,
  );
  /**
   * 保存后关闭旧快照，刷新列表并提示公开端缓存更新延迟。
   */
  function saved() {
    setSelected(undefined);
    setMessage('译名已保存；客户端将在缓存到期后更新。');
    resource.refresh();
  }
  const columns: TableProps<CatalogItem>['columns'] = [
    {
      title: '原始名称',
      dataIndex: 'name',
      width: 240,
      // 原始名称和稳定 ID 只展示，不纳入编辑表单。
      render: (_, row) => (
        <>
          <Typography.Text strong>{row.name}</Typography.Text>
          <div className="secondary-line mono">{row.id}</div>
        </>
      ),
    },
    {
      title: '英文展示名',
      dataIndex: 'nameEn',
      width: 200,
      // null 表示沿用名称兜底，不显示字符串 null。
      render: (value: string | null) =>
        value ?? <Typography.Text type="secondary">未设置</Typography.Text>,
    },
    {
      title: '中文展示名',
      dataIndex: 'nameZh',
      width: 200,
      // 空译名仍可后续校订。
      render: (value: string | null) =>
        value ?? <Typography.Text type="secondary">未设置</Typography.Text>,
    },
    {
      title: '代码',
      dataIndex: 'code',
      width: 100,
      // 标签通常没有代码，保持明确占位。
      render: (value: string | null) => value ?? '—',
    },
    {
      title: '操作',
      fixed: 'right',
      width: 110,
      // viewer 不提供任何校订入口。
      render: (_, row) =>
        writable ? (
          <Button
            type="link"
            onClick={
              // 保留读取时的原译名供乐观锁校验。
              () => setSelected(row)
            }
          >
            校订译名
          </Button>
        ) : (
          <Typography.Text type="secondary">只读</Typography.Text>
        ),
    },
  ];
  return (
    <>
      <PageHeader
        title="分类与译名"
        description="统一维护国家 / 地区、语言与标签的中英文展示名"
        action={
          <RefreshButton
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
      />
      <Notice message={message} type="success" />
      <Card>
        <Tabs
          activeKey={kind}
          items={[
            { key: 'countries', label: '国家 / 地区' },
            { key: 'languages', label: '语言' },
            { key: 'tags', label: '标签' },
          ]}
          onChange={
            // 只接受固定标签页，切换时清空查询和旧记录。
            (key) => {
              if (
                key === 'countries' ||
                key === 'languages' ||
                key === 'tags'
              ) {
                setKind(key);
                setQ('');
                setPage(1);
                setSelected(undefined);
                setMessage('');
              }
            }
          }
        />
        <Space wrap className="table-toolbar">
          <Input
            className="catalog-search"
            prefix={<SearchOutlined />}
            allowClear
            value={q}
            aria-label="搜索分类"
            placeholder="搜索原名、中文或英文"
            onChange={
              // 搜索由服务端执行，覆盖完整字典。
              (event) => {
                setQ(event.target.value);
                setPage(1);
              }
            }
          />
          <Button
            onClick={
              // 恢复当前分类的完整列表。
              () => {
                setQ('');
                setPage(1);
              }
            }
          >
            重置
          </Button>
        </Space>
        <DataTable
          resource={resource}
          columns={columns}
          page={page}
          onChange={setPage}
        />
      </Card>
      {selected && (
        <CatalogEditor
          key={`${kind}-${selected.id}`}
          kind={kind}
          item={selected}
          onSaved={saved}
          onClose={
            // 弹窗内部完成未保存检查。
            () => setSelected(undefined)
          }
        />
      )}
    </>
  );
}

/**
 * 译名表单携带旧译名快照，版本冲突时保留输入，不自动覆盖并发校订。
 */
function CatalogEditor({
  kind,
  item,
  onSaved,
  onClose,
}: {
  kind: CatalogKind;
  item: CatalogItem;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const { modal } = App.useApp();
  /**
   * 关闭前确认尚未提交的译名，写入过程中禁止取消。
   */
  function close() {
    if (busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    modal.confirm({
      title: '放弃未保存的译名？',
      content: '当前输入尚未保存。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      onOk: onClose,
    });
  }
  /**
   * 留空提交 null，继续使用客户端原有名称兜底规则。
   */
  async function submit(values: { nameEn?: string; nameZh?: string }) {
    setBusy(true);
    setError('');
    try {
      await save(`/admin/api/catalog/${kind}/${item.id}`, {
        nameEn: values.nameEn || null,
        nameZh: values.nameZh || null,
        expectedNameEn: item.nameEn,
        expectedNameZh: item.nameZh,
      });
      onSaved();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title={`校订译名 · ${item.name}`}
      onCancel={close}
      mask={{ closable: false }}
      closable={!busy}
      keyboard={!busy}
      confirmLoading={busy}
      okText="保存译名"
      cancelText="取消"
      okButtonProps={{ htmlType: 'submit', form: 'catalog-form' }}
      cancelButtonProps={{ disabled: busy }}
    >
      <Typography.Paragraph type="secondary">
        原名、代码和关联 ID
        保持不变。展示名留空时，客户端沿用既有的名称兜底规则。
      </Typography.Paragraph>
      <Notice message={error} type="error" />
      <Form
        id="catalog-form"
        layout="vertical"
        disabled={busy}
        initialValues={item}
        onFinish={submit}
        onValuesChange={
          // 只标记用户输入，初始化表单不标记草稿。
          () => setDirty(true)
        }
      >
        <Form.Item name="nameEn" label="英文展示名" rules={[{ max: 200 }]}>
          <Input maxLength={200} showCount />
        </Form.Item>
        <Form.Item name="nameZh" label="中文展示名" rules={[{ max: 200 }]}>
          <Input maxLength={200} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
