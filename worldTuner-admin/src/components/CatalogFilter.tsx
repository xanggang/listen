import { useState } from 'react';
import { Button, Empty, Select, Space, Typography } from 'antd';
import type { CatalogKind, CatalogItem, Page } from '../lib/contracts';
import { useDebounced, useResource } from '../lib/hooks';
/**
 * 远程搜索完整分类字典；已选项跨搜索保留，未加载的初始 ID 使用明确兜底文案。
 */
export function CatalogFilter({
  kind,
  label,
  value,
  onChange,
  disabled = false,
}: {
  kind: CatalogKind;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<CatalogItem>();
  const keyword = useDebounced(q);
  const resource = useResource<Page<CatalogItem>>(
    `/admin/api/catalog/${kind}?pageSize=50&q=${encodeURIComponent(keyword)}`,
  );
  const options = [...(resource.data?.list ?? [])];
  // 仅补充缺失的已选分类，避免候选 ID 重复。
  if (selected && !options.some((row) => row.id === selected.id))
    options.unshift(selected);
  // 初始选项可能位于远程字典其他页，仍然保留其关联。
  const hasValue = options.some((row) => row.id === value);
  return (
    <div className="filter-field">
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Select
        aria-label={label}
        disabled={disabled}
        showSearch={{ filterOption: false, onSearch: setQ }}
        allowClear
        loading={resource.loading}
        value={value || undefined}
        placeholder={`全部${label}`}
        options={[
          ...(value && !hasValue
            ? [{ value, label: `当前选择 · ${value}` }]
            : []),
          // 字典优先显示中文，其次英文和来源原名。
          ...options.map((row) => ({
            value: row.id,
            label: row.nameZh ?? row.nameEn ?? row.name,
          })),
        ]}
        notFoundContent={
          resource.error ? (
            <Space orientation="vertical">
              <Typography.Text type="danger">分类加载失败</Typography.Text>
              <Button size="small" onClick={resource.refresh}>
                重试
              </Button>
            </Space>
          ) : resource.loading ? (
            '正在搜索…'
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="没有匹配的分类"
            />
          )
        }
        onChange={
          // 清空只移除关联，选择时保留完整名称用于后续搜索显示。
          (id: string | undefined) => {
            setSelected(
              options.find(
                // 匹配字典的稳定 ID，不依赖译名。
                (row) => row.id === id,
              ),
            );
            onChange(id ?? '');
          }
        }
      />
    </div>
  );
}
