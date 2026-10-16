import { useState } from 'react';
import type { CatalogKind, CatalogItem, Page } from '../lib/contracts';
import { useDebounced, useResource } from '../lib/hooks';
/**
 * 分类筛选通过服务端搜索访问完整字典，保留已选项，避免只支持前几十个标签。
 */
export function CatalogFilter({
  kind,
  label,
  value,
  onChange,
}: {
  kind: CatalogKind;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<CatalogItem>();
  const keyword = useDebounced(q);
  const { data, error } = useResource<Page<CatalogItem>>(
    `/admin/api/catalog/${kind}?pageSize=50&q=${encodeURIComponent(keyword)}`,
  );
  const options = data?.list ?? [];
  const visible =
    selected &&
    !options.some(
      // 已选项目不在新搜索结果时仍保留，筛选值不会无声丢失。
      (row) => row.id === selected.id,
    )
      ? [selected, ...options]
      : options;
  return (
    <label className="catalog-filter">
      <span>{label}</span>
      <input
        aria-label={`搜索${label}`}
        placeholder={`搜索${label}…`}
        value={q}
        onChange={
          // 关键字只用于查找候选分类，选择后才改变电台筛选。
          (event) => setQ(event.target.value)
        }
      />
      <select
        aria-label={`选择${label}`}
        value={value}
        onChange={
          // 保存完整已选项，切换查询后仍能显示译名。
          (event) => {
            const id = event.target.value;
            setSelected(
              options.find(
                // 使用分类 ID 作为稳定关联键。
                (row) => row.id === id,
              ),
            );
            onChange(id);
          }
        }
      >
        <option value="">全部{label}</option>
        {value &&
          !visible.some(
            // 编辑器初始分类可能尚不在候选前 50 项中，仍明确保留选择。
            (row) => row.id === value,
          ) && <option value={value}>当前选择 · {value}</option>}
        {visible.map(
          // 优先显示中文，英文与原名兜底，不修改实际分类 ID。
          (row) => (
            <option key={row.id} value={row.id}>
              {row.nameZh ?? row.nameEn ?? row.name}
            </option>
          ),
        )}
      </select>
      {error && <small className="error">分类加载失败，修改搜索词可重试</small>}
    </label>
  );
}
