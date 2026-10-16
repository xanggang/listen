import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// 执行真实安卓地球脚本，确认定位不会触发选台/播放，且过滤错误坐标。
test('globe focus waits for readiness and preserves playback source', () => {
  const events = new Map();
  const sources = new Map();
  const flights = [];
  const messages = [];
  const sdk = {
    config: {},
    Map: class {
      // 保存加载回调，测试按真实加载顺序推进。
      on(name, callback) { events.set(name, callback); }
      // 为每个源记录实际更新的数据，用于检查定位与播放是否隔离。
      addSource(name, options) {
        sources.set(name, {
          data: options.data,
          // 模拟 SDK 的 GeoJSON 更新接口。
          setData(data) { this.data = data; },
        });
      }
      // 图层渲染不属于相机导航测试范围。
      addLayer() {}
      // 返回已注册数据源，避免绕过真实脚本的数据流。
      getSource(name) { return sources.get(name); }
      // 原生 WebView 恢复显示时允许重新测量容器。
      resize() {}
      // 捕获相机参数，不创建 WebGL。
      flyTo(options) { flights.push(options); }
    },
  };
  const window = {
    maptilersdk: sdk,
    AetherBridge: {
      // 记录桥接消息，确保定位不会伪造电台点击事件。
      postMessage(raw) { messages.push(JSON.parse(raw)); },
    },
  };
  runInNewContext(
    readFileSync(new URL('../../worldTuner-mobile/assets/globe/globe.js', import.meta.url), 'utf8'),
    {
      window, maptilersdk: sdk,
      document: {
        body: { dataset: {} },
        // 无装饰 HUD 不影响地图定位。
        getElementById() { return null; },
      },
    },
  );
  const station = { id: '0aB12xY', longitude: 0, latitude: 0 };
  window.AetherGlobe.initialize({ key: 'test-key' });
  window.AetherGlobe.focusStation(station);
  assert.equal(flights.length, 0);
  events.get('load')();
  const playingSource = sources.get('active-station').data;
  for (const invalid of [null, { ...station, latitude: 91 }, { ...station, longitude: NaN }, { ...station, id: 'bad' }]) {
    window.AetherGlobe.focusStation(invalid);
  }
  assert.equal(flights.length, 0);
  window.AetherGlobe.focusStation(station);
  window.AetherGlobe.focusStation(station);
  assert.equal(flights.length, 2);
  assert.deepEqual(Array.from(flights[0].center), [0, 0]);
  assert.equal(flights[0].zoom, 7);
  assert.equal(sources.get('focused-station').data.features[0].properties.id, station.id);
  assert.equal(sources.get('active-station').data, playingSource);
  assert.deepEqual(messages, [{ type: 'ready' }]);
});
