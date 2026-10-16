import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createGlobeOptions, GLOBE_STYLE_URL } from '../src/lib/globe-options.ts';

// 执行实际安卓初始化脚本，比对传给 SDK 的配置，防止两端底图/地形/视角再次漂移。
test('Web and Android initialize the same versioned satellite globe and terrain', () => {
  let mobileOptions;
  const sdk = {
    config: {},
    MapStyle: { SATELLITE: 'different-sdk-default-style' },
    Map: class {
      /**
       * 捕获初始化参数，不创建 WebGL 或访问网络。
       */
      constructor(options) { mobileOptions = options; }
      /**
       * 初始化阶段只注册事件；测试不模拟影像瓦片和渲染。
       */
      on() { return this; }
    },
  };
  const window = { maptilersdk: sdk };
  runInNewContext(
    readFileSync(new URL('../../worldTuner-mobile/assets/globe/globe.js', import.meta.url), 'utf8'),
    { window, maptilersdk: sdk, document: { body: { dataset: {} } } },
  );
  window.AetherGlobe.initialize({ key: 'public-test-key', theme: 'dark' });
  const webOptions = createGlobeOptions();
  const commonMobileOptions = {};
  for (const key of Object.keys(webOptions)) commonMobileOptions[key] = mobileOptions[key];
  assert.deepEqual(JSON.parse(JSON.stringify(commonMobileOptions)), webOptions);
  assert.equal(GLOBE_STYLE_URL, 'https://api.maptiler.com/maps/satellite-v4/style.json');
});
