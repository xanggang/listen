import { useState, type FormEvent } from 'react';
import type { CatalogItem, CatalogKind, Page } from '../lib/contracts';
import { useDebounced, useResource } from '../lib/hooks';
import { save, errorMessage } from '../lib/api';
import { Notice, PageHeader, Pager, ResourceState } from '../components/common';
/**
 * 分类管理只校订展示名，保留来源原名、国家/语言代码及稳定 ID。
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
   * 保存后刷新列表，关闭旧版本表单，避免后续再次提交旧期望值。
   */
  function saved() {
    setSelected(undefined);
    setMessage('译名已保存；客户端将在缓存到期后更新。');
    resource.refresh();
  }
  return (
    <>
      <PageHeader
        title="分类与译名"
        description="维护国家/地区、语言和标签的中英文展示名"
      />
      <Notice message={message} />
      <section className="panel">
        <div className="toolbar">
          <label>
            分类
            <select
              value={kind}
              onChange={
                // 切换分类时清空编辑与分页，不复用其他表的记录。
                (event) => {
                  setKind(event.target.value as CatalogKind);
                  setSelected(undefined);
                  setPage(1);
                }
              }
            >
              <option value="countries">国家/地区</option>
              <option value="languages">语言</option>
              <option value="tags">标签</option>
            </select>
          </label>
          <label className="grow">
            搜索
            <input
              value={q}
              placeholder="原名、中文或英文"
              onChange={
                // 支持全量分类搜索，不只过滤当前页面。
                (event) => {
                  setQ(event.target.value);
                  setPage(1);
                }
              }
            />
          </label>
          <button onClick={resource.refresh}>刷新</button>
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
                    <th>原始名称</th>
                    <th>英文展示名</th>
                    <th>中文展示名</th>
                    <th>代码</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.list.map(
                    // 原名仅展示，编辑窗口仅开放译名。
                    (row) => (
                      <tr key={row.id}>
                        <td>
                          {row.name}
                          <small className="mono">{row.id}</small>
                        </td>
                        <td>{row.nameEn ?? '—'}</td>
                        <td>{row.nameZh ?? '—'}</td>
                        <td>{row.code ?? '—'}</td>
                        <td>
                          {writable ? (
                            <button
                              onClick={
                                // 保存完整旧译名作为乐观锁快照。
                                () => setSelected(row)
                              }
                            >
                              校订译名
                            </button>
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
      {selected && (
        <CatalogEditor
          key={selected.id}
          kind={kind}
          item={selected}
          onSaved={saved}
          onClose={
            // 放弃当前未保存译名，不改变数据库。
            () => setSelected(undefined)
          }
        />
      )}
    </>
  );
}
/**
 * 译名编辑携带读取时的原值，服务器不覆盖并发校订。
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
  const [message, setMessage] = useState('');
  /**
   * 空展示名提交 null，继续使用客户端既定语言兜底规则。
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      await save(`/admin/api/catalog/${kind}/${item.id}`, {
        nameEn: String(form.get('nameEn')) || null,
        nameZh: String(form.get('nameZh')) || null,
        expectedNameEn: item.nameEn,
        expectedNameZh: item.nameZh,
      });
      onSaved();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="editor compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-title"
      >
        <div className="editor-heading">
          <h2 id="catalog-title">校订 · {item.name}</h2>
          <button disabled={busy} onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="muted">
          原名和关联 ID 保持不变。留空时客户端使用下一层名称兜底。
        </p>
        <Notice message={message} />
        <form onSubmit={submit}>
          <label>
            英文展示名
            <input
              name="nameEn"
              defaultValue={item.nameEn ?? ''}
              maxLength={200}
            />
          </label>
          <label>
            中文展示名
            <input
              name="nameZh"
              defaultValue={item.nameZh ?? ''}
              maxLength={200}
            />
          </label>
          <button className="primary" disabled={busy} type="submit">
            保存译名
          </button>
        </form>
      </section>
    </div>
  );
}
