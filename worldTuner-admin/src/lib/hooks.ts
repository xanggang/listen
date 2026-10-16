import { useEffect, useState } from 'react';
import { apiRequest, errorMessage } from './api';

/**
 * 查询路径变化或手动刷新时加载真实接口，取消旧请求，防止慢响应覆盖新筛选。
 */
export function useResource<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(
    // 每轮查询有独立取消信号，组件卸载或条件改变后禁止更新界面。
    () => {
      const controller = new AbortController();
      setLoading(true);
      setError('');
      setData(undefined);
      void apiRequest<T>(path, { signal: controller.signal })
        .then(
          // 只展示当前轮次查询的数据。
          (value) => {
            if (!controller.signal.aborted) setData(value);
          },
        )
        .catch(
          // 主动取消不弹错误，真实请求失败可手动重试。
          (reason: unknown) => {
            if (!controller.signal.aborted) setError(errorMessage(reason));
          },
        )
        .finally(
          // 已取消的请求不能结束新请求的加载指示。
          () => {
            if (!controller.signal.aborted) setLoading(false);
          },
        );
      return () => controller.abort();
    },
    [path, revision],
  );
  /**
   * 重新请求当前筛选，不改变列表分页条件。
   */
  function refresh() {
    setRevision(
      // 单调递增触发一次新的查询。
      (value) => value + 1,
    );
  }
  return { data, error, loading, refresh };
}
/**
 * 搜索输入停止 250ms 后再查接口，减少逐字输入产生的数据库读取。
 */
export function useDebounced(value: string) {
  const [result, setResult] = useState(value);
  useEffect(
    // 替换输入时取消旧计时器。
    () => {
      const timer = setTimeout(
        // 只提交停止输入后的最新关键字。
        () => setResult(value),
        250,
      );
      return () => clearTimeout(timer);
    },
    [value],
  );
  return result;
}
