import { useState } from 'react';
import type { Analytics, Overview } from '../lib/contracts';
import { useResource } from '../lib/hooks';
import { PageHeader, ResourceState } from '../components/common';
/**
 * 总览与分析共享真实 UTC 统计，分平台展示 UV/MAU，不将日 UV 累加成总用户数。
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
  const { data, loading, error, refresh } = useResource<Overview>(
    `/admin/api/analytics${overview ? '/overview' : ''}?${query}`,
  );
  const pv =
    data?.daily.reduce(
      // PV 可以跨日相加，UV 在下表按日分别展示。
      (total, row) => total + row.pv,
      0,
    ) ?? 0;
  const stations =
    data?.catalog?.reduce(
      // 每个电台只属于一个状态分组，不重复累计。
      (total, row) => total + row.count,
      0,
    ) ?? 0;
  const visible =
    data?.catalog
      ?.filter(
        // 这里只统计上架数量，不能解释为全部可播放电台。
        (row) => row.visibility === 'visible',
      )
      .reduce(
        // 汇总上架状态下的不同目录状态。
        (total, row) => total + row.count,
        0,
      ) ?? 0;
  return (
    <>
      <PageHeader
        title={overview ? '工作台' : '访问分析'}
        description="匿名访客统计 · UTC 时区 · Web 与 Android 独立计数"
        action={<button onClick={refresh}>刷新数据</button>}
      />
      <div className="toolbar">
        <label>
          时间范围
          <select
            value={days}
            onChange={
              // 切换有限时间范围，避免无界扫描去重表。
              (event) => setDays(Number(event.target.value))
            }
          >
            <option value="7">最近 7 天</option>
            <option value="14">最近 14 天</option>
            <option value="31">最近 31 天</option>
          </select>
        </label>
        <label>
          平台
          <select
            value={source}
            onChange={
              // 平台过滤应用于日/月统计的同一查询。
              (event) => setSource(event.target.value)
            }
          >
            <option value="">全部平台</option>
            <option value="web">Web</option>
            <option value="android">Android</option>
          </select>
        </label>
        <span className="muted">
          {from} — {to}
        </span>
      </div>
      <ResourceState loading={loading} error={error} retry={refresh} />
      {data && (
        <>
          <div className="stats">
            <Metric
              title="页面访问 PV"
              value={pv}
              note={`最近 ${days} 天有效页面访问`}
            />
            {overview && (
              <>
                <Metric
                  title="电台总数"
                  value={stations}
                  note="包含隐藏及未验证电台"
                />
                <Metric
                  title="已上架电台"
                  value={visible}
                  note="播放可用性由目录状态与流共同决定"
                />
              </>
            )}
          </div>
          <MetricsTables data={data} />
        </>
      )}
    </>
  );
}
/**
 * 指标卡只展示已加载接口结果，不用演示值填补空数据。
 */
function Metric({
  title,
  value,
  note,
}: {
  title: string;
  value: number;
  note: string;
}) {
  return (
    <article className="metric">
      <span>{title}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>{note}</small>
    </article>
  );
}
/**
 * 逐日、逐月展示独立访客口径，避免将活跃匿名访客误称注册用户或新增装机。
 */
function MetricsTables({ data }: { data: Analytics }) {
  return (
    <div className="analytics-grid">
      <section className="panel">
        <div className="panel-heading">
          <h2>每日访问</h2>
          <span className="muted">PV / 日 UV</span>
        </div>
        {!data.daily.length ? (
          <div className="state">暂无访问统计</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日期 UTC</th>
                  <th>平台</th>
                  <th>PV</th>
                  <th>UV</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map(
                  // 日期与平台共同标识一行，不混合独立访客身份。
                  (row) => (
                    <tr key={`${row.day}-${row.source}`}>
                      <td>{row.day}</td>
                      <td>{row.source}</td>
                      <td>{row.pv.toLocaleString()}</td>
                      <td>{row.uv.toLocaleString()}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>月活跃访客</h2>
          <span className="muted">月内去重 MAU</span>
        </div>
        {!data.monthly.length ? (
          <div className="state">暂无月活数据</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>月份</th>
                  <th>平台</th>
                  <th>MAU</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map(
                  // MAU 由服务器月内去重计算，不能用日 UV 相加代替。
                  (row) => (
                    <tr key={`${row.month}-${row.source}`}>
                      <td>{row.month}</td>
                      <td>{row.source}</td>
                      <td>{row.mau.toLocaleString()}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="panel-note">
          匿名标识不跨端合并；本月为截至当前的累计月活，不代表新增用户。
        </p>
      </section>
    </div>
  );
}
