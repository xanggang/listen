import { useState, type FormEvent } from 'react';
import type { Page, Station, StationDetail, Stream } from '../lib/contracts';
import { useDebounced, useResource } from '../lib/hooks';
import { apiRequest, save, errorMessage } from '../lib/api';
import { CatalogFilter } from '../components/CatalogFilter';
import {
  Notice,
  PageHeader,
  Pager,
  ResourceState,
  Status,
} from '../components/common';

/**
 * 电台管理包含完整目录、关联筛选与软上下架；只有 owner 可以进入写入操作。
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
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
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
   * 选择时重新获取详情，避免用列表缓存中的旧版本开始编辑。
   */
  async function open(id: string) {
    setBusy(true);
    setMessage('');
    try {
      setDetail(await apiRequest<StationDetail>(`/admin/api/stations/${id}`));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  /**
   * 保存成功后刷新列表，并以服务器返回版本更新编辑器。
   */
  function updated(value: StationDetail) {
    setDetail(value);
    resource.refresh();
    setMessage(
      '已保存。服务端列表/详情缓存为 60 秒，地图按配置 TTL 更新；App 已加载的页面可能需重新进入或重启。',
    );
  }
  return (
    <>
      <PageHeader
        title="电台管理"
        description="统一管理电台基本信息、播放流与上下架状态"
        action={<button onClick={resource.refresh}>刷新列表</button>}
      />
      <Notice message={message} />
      <section className="panel">
        <div className="toolbar">
          <label className="grow">
            查找电台
            <input
              placeholder="电台名称或 7 位 ID"
              value={q}
              onChange={
                // 搜索条件变化时返回第一页，再由防抖值查询接口。
                (event) => {
                  setQ(event.target.value);
                  setPage(1);
                }
              }
            />
          </label>
          <label>
            可见性
            <select
              value={visibility}
              onChange={
                // 显示隐藏电台供重新上架，不复用公开可见筛选。
                (event) => {
                  setVisibility(event.target.value);
                  setPage(1);
                }
              }
            >
              <option value="">全部状态</option>
              <option value="visible">已上架</option>
              <option value="hidden">已下架</option>
            </select>
          </label>
          <label>
            目录状态
            <select
              value={status}
              onChange={
                // 可查看来源标记为失效的电台并修正播放流。
                (event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }
              }
            >
              <option value="">全部</option>
              <option value="active">可用</option>
              <option value="unverified">未验证</option>
              <option value="unavailable">不可用</option>
            </select>
          </label>
        </div>
        <details className="filters">
          <summary>国家、语言与标签筛选</summary>
          <div className="filter-grid">
            <CatalogFilter
              kind="countries"
              label="国家/地区"
              value={countryId}
              onChange={
                // 应用国家关联筛选，分类 ID 保持字符串。
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
                // 语言关联独立于界面语言。
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
                // 标签精确关联筛选，不使用名称模糊匹配。
                (id) => {
                  setTagId(id);
                  setPage(1);
                }
              }
            />
          </div>
        </details>
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
                    <th>电台</th>
                    <th>国家/地区</th>
                    <th>状态</th>
                    <th>来源</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.list.map(
                    // 行 ID 使用 public_id，不在 UI 展示内部主键。
                    (station) => (
                      <tr key={station.id}>
                        <td>
                          <strong>{station.name}</strong>
                          <small className="mono">{station.id}</small>
                        </td>
                        <td>
                          {station.country ?? '—'}
                          <small>{station.place ?? '—'}</small>
                        </td>
                        <td>
                          <Status value={station.visibility} />
                          <small>
                            <Status value={station.status} />
                          </small>
                        </td>
                        <td>{station.source}</td>
                        <td className="mono">{station.updatedAt}</td>
                        <td>
                          <button
                            disabled={busy}
                            onClick={
                              // 只读角色仍可查看电台与流，不显示写按钮。
                              () => void open(station.id)
                            }
                          >
                            {writable ? '查看 / 编辑' : '查看详情'}
                          </button>
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
      {detail && (
        <StationEditor
          key={`${detail.id}-${detail.updatedAt}`}
          station={detail}
          writable={writable}
          onSaved={updated}
          onClose={
            // 关闭详情不修改服务器已保存的状态。
            () => setDetail(undefined)
          }
        />
      )}
    </>
  );
}

/**
 * 详情编辑器以读取版本提交，保存失败保留输入，409 提示重新加载避免覆盖。
 */
function StationEditor({
  station,
  writable,
  onSaved,
  onClose,
}: {
  station: StationDetail;
  writable: boolean;
  onSaved: (station: StationDetail) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [countryId, setCountryId] = useState(station.countryId ?? '');
  /**
   * 提交允许编辑的基本字段；空坐标同时为 null，服务器再检查坐标范围。
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      onSaved(
        await save<StationDetail>(`/admin/api/stations/${station.id}`, {
          expectedUpdatedAt: station.updatedAt,
          name: String(form.get('name')),
          status: String(form.get('status')),
          place: String(form.get('place')) || null,
          countryId: countryId || null,
          website: String(form.get('website')) || null,
          favicon: String(form.get('favicon')) || null,
          latitude:
            form.get('latitude') === '' ? null : Number(form.get('latitude')),
          longitude:
            form.get('longitude') === '' ? null : Number(form.get('longitude')),
        }),
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  /**
   * 上下架与基本信息保存分开，明确状态改变且使用相同乐观锁。
   */
  async function toggleVisibility() {
    setBusy(true);
    setMessage('');
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
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  /**
   * 获取最新服务器状态，用于冲突恢复；明确丢弃尚未保存的编辑。
   */
  async function reload() {
    if (!window.confirm('重新加载会丢弃未保存的修改，是否继续？')) return;
    setBusy(true);
    try {
      onSaved(
        await apiRequest<StationDetail>(`/admin/api/stations/${station.id}`),
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-title"
      >
        <div className="editor-heading">
          <div>
            <small className="mono">{station.id}</small>
            <h2 id="station-title">{station.name}</h2>
          </div>
          <button onClick={onClose} disabled={busy}>
            关闭
          </button>
        </div>
        <Notice message={message} />
        <div className="toolbar">
          <Status value={station.visibility} />
          <Status value={station.status} />
          <button
            onClick={
              // 冲突时手动取回最新版本，不自动覆盖输入。
              () => void reload()
            }
            disabled={busy}
          >
            重新加载
          </button>
          {writable && (
            <button
              className={
                station.visibility === 'visible' ? 'danger' : 'primary'
              }
              onClick={
                // 状态修改失败时留在编辑器，反馈可见且不会重试写操作。
                () => void toggleVisibility()
              }
              disabled={busy}
            >
              {station.visibility === 'visible' ? '下架电台' : '上架电台'}
            </button>
          )}
        </div>
        <form onSubmit={submit}>
          <fieldset disabled={!writable || busy}>
            <div className="form-grid">
              <label>
                目录状态
                <select name="status" defaultValue={station.status}>
                  <option value="active">可用</option>
                  <option value="unverified">未验证</option>
                  <option value="unavailable">不可用</option>
                </select>
              </label>
              {[
                ['name', '电台名称', station.name],
                ['place', '地区/城市', station.place ?? ''],
                ['website', '网站地址', station.website ?? ''],
                ['favicon', '图标地址', station.favicon ?? ''],
                ['latitude', '纬度', station.latitude ?? ''],
                ['longitude', '经度', station.longitude ?? ''],
              ].map(
                // 固定字段生成表单；URL 不作为图片自动加载，避免外部跟踪与请求。
                ([name, label, value]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={String(name)}
                      defaultValue={String(value)}
                      required={name === 'name'}
                      maxLength={
                        name === 'website' || name === 'favicon' ? 2048 : 200
                      }
                    />
                  </label>
                ),
              )}
              <CatalogFilter
                kind="countries"
                label={`国家/地区（当前：${station.country ?? '未设置'}）`}
                value={countryId}
                onChange={setCountryId}
              />
            </div>
            {writable && (
              <button className="primary" type="submit" disabled={busy}>
                保存基本信息
              </button>
            )}
          </fieldset>
        </form>
        <h3>播放流 · {station.streams.length}</h3>
        {station.streams.map(
          // 每个流表单独立提交，父电台版本变化时整个编辑器重建。
          (stream) => (
            <StreamEditor
              key={stream.id}
              station={station}
              stream={stream}
              writable={writable}
              onSaved={onSaved}
            />
          ),
        )}
      </section>
    </div>
  );
}

/**
 * 已有流编辑仅更改 URL、编码与 HLS 信息，保留主流标记和 ID。
 */
function StreamEditor({
  station,
  stream,
  writable,
  onSaved,
}: {
  station: StationDetail;
  stream: Stream;
  writable: boolean;
  onSaved: (station: StationDetail) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  /**
   * 播放流保存带电台版本与流 ID，由服务端再验证流归属。
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      onSaved(
        await save<StationDetail>(
          `/admin/api/stations/${station.id}/streams/${stream.id}`,
          {
            expectedUpdatedAt: station.updatedAt,
            url: String(form.get('url')),
            resolvedUrl: String(form.get('resolvedUrl')) || null,
            codec: String(form.get('codec')) || null,
            bitrate:
              form.get('bitrate') === '' ? null : Number(form.get('bitrate')),
            isHls: form.get('isHls') === 'on',
          },
        ),
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stream-form" onSubmit={submit}>
      <div className="panel-heading">
        <span className="mono">{stream.id}</span>
        <span className="badge">
          {stream.isPrimary ? '主播放流' : '备用流'}
        </span>
      </div>
      <Notice message={message} />
      <fieldset disabled={!writable || busy}>
        <div className="form-grid">
          <label>
            原始 URL
            <input
              name="url"
              defaultValue={stream.url}
              required
              maxLength={2048}
            />
          </label>
          <label>
            解析 URL
            <input
              name="resolvedUrl"
              defaultValue={stream.resolvedUrl ?? ''}
              maxLength={2048}
            />
          </label>
          <label>
            编码
            <input
              name="codec"
              defaultValue={stream.codec ?? ''}
              maxLength={40}
            />
          </label>
          <label>
            比特率
            <input
              name="bitrate"
              type="number"
              min="0"
              max="100000"
              defaultValue={stream.bitrate ?? ''}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              name="isHls"
              defaultChecked={stream.isHls === 1}
            />
            HLS 播放流
          </label>
        </div>
        {writable && (
          <button type="submit" disabled={busy}>
            保存播放流
          </button>
        )}
      </fieldset>
    </form>
  );
}
