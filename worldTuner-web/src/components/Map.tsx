'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { Map as MapTilerMap, MapStyle, config } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

interface MapProps {
  onChange?: (stationId: number) => void;
}

/** 按经纬度生成与安卓端一致的 30 度辅助线，不写入电台数据。 */
function createGraticule(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (let longitude = -180; longitude <= 180; longitude += 30) {
    const coordinates: [number, number][] = [];
    for (let latitude = -85; latitude <= 85; latitude += 5) {
      coordinates.push([longitude, latitude]);
    }
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
  }
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const coordinates: [number, number][] = [];
    for (let longitude = -180; longitude <= 180; longitude += 5) {
      coordinates.push([longitude, latitude]);
    }
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
  }
  return { type: 'FeatureCollection', features };
}

/** 按需读取静态快照，只解析 id 与坐标，不把完整文件打进页面脚本。 */
async function loadStationFeatures(signal: AbortSignal): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  const response = await fetch('/data.json', { signal, cache: 'force-cache' });
  if (!response.ok) throw new Error('Station snapshot unavailable');
  const payload: unknown = await response.json();
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw new Error('Invalid station snapshot');
  }
  const records = payload.data;
  if (!Array.isArray(records)) throw new Error('Invalid station snapshot');
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const value of records) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
    const point = value as Record<string, unknown>;
    const { id, geoLat, geoLong } = point;
    if (
      typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 ||
      typeof geoLat !== 'number' || !Number.isFinite(geoLat) || Math.abs(geoLat) > 90 ||
      typeof geoLong !== 'number' || !Number.isFinite(geoLong) || Math.abs(geoLong) > 180
    ) continue;
    features.push({
      type: 'Feature',
      properties: { id },
      geometry: { type: 'Point', coordinates: [geoLong, geoLat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** 地图加载完成后同步空间、辅助线和点位配色，避免初始化期间重复添加 Cubemap 图层。 */
function applyGlobeTheme(globe: MapTilerMap, dark: boolean): void {
  globe.setSpace({ color: dark ? '#0e1321' : '#f8fafc' });
  const color = dark ? '#00f2fe' : '#0284c7';
  if (globe.getLayer('graticule-lines')) {
    globe.setPaintProperty('graticule-lines', 'line-color', color);
  }
  if (globe.getLayer('station-points')) {
    globe.setPaintProperty('station-points', 'circle-color', color);
  }
}

/** 绘制安卓端同款卫星地球、地形和逐点电台，不对点位聚合。 */
export default function Map({ onChange }: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapTilerMap | null>(null);
  const mapReady = useRef(false);
  const onChangeRef = useRef(onChange);
  const [hudVisible, setHudVisible] = useState(true);
  const [pointsError, setPointsError] = useState(false);
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  onChangeRef.current = onChange;

  useEffect(
    /** 初始化一次地球；卸载时同步释放 WebGL 资源和事件。 */
    () => {
      if (!container.current || map.current) return;
      const pointsController = new AbortController();
      config.apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY || '5dPy611BtAufNGOyAaVt';
      const globe = new MapTilerMap({
        container: container.current,
        style: MapStyle.SATELLITE,
        projection: 'globe',
        terrain: true,
        terrainExaggeration: 1.35,
        center: [20, 25],
        zoom: 0.9,
        minZoom: -1,
        maxZoom: 15,
        maxPitch: 85,
        space: {
          color: document.documentElement.classList.contains('dark') ? '#0e1321' : '#f8fafc',
        },
        halo: true,
        navigationControl: false,
        geolocateControl: false,
        terrainControl: false,
      });
      map.current = globe;

      // 底图就绪后一次性注册辅助线、独立点位与点击事件。
      globe.on('load', () => {
        const dark = document.documentElement.classList.contains('dark');
        const accent = dark ? '#00f2fe' : '#0284c7';
        globe.addSource('graticule', { type: 'geojson', data: createGraticule() });
        globe.addLayer({
          id: 'graticule-lines',
          type: 'line',
          source: 'graticule',
          maxzoom: 3,
          paint: {
            'line-color': accent,
            'line-opacity': dark ? 0.24 : 0.28,
            'line-width': 0.7,
          },
        });
        globe.addSource('stations', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        globe.addLayer({
          id: 'station-points',
          type: 'circle',
          source: 'stations',
          paint: {
            'circle-color': accent,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.2, 5, 3.4, 10, 5],
            'circle-opacity': 0.82,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 0.5,
          },
        });
        mapReady.current = true;
        applyGlobeTheme(globe, dark);
        // 点位文件加载完成后一次性更新图层；组件卸载则取消请求。
        void loadStationFeatures(pointsController.signal)
          .then(
            /** 地球仍存活时才替换空图层，保持每个电台独立点位。 */
            (features) => {
              if (map.current !== globe) return;
              const source = globe.getSource('stations');
              if (source && 'setData' in source && typeof source.setData === 'function') {
                (source as { setData: (data: GeoJSON.FeatureCollection<GeoJSON.Point>) => void })
                  .setData(features);
              }
            },
          )
          .catch(
            /** 静态快照失效时保留地球并显示轻量提示。 */
            () => { if (!pointsController.signal.aborted) setPointsError(true); },
          );
        // 点击点位只回传 id，播放器再从 API 获取完整电台详情。
        globe.on('click', 'station-points', (event) => {
          const id = Number(event.features?.[0]?.properties?.id);
          if (Number.isSafeInteger(id) && id > 0) onChangeRef.current?.(id);
        });
        // 鼠标进入或离开电台时只改变指针，不增加地图控件。
        globe.on('mouseenter', 'station-points', () => {
          globe.getCanvas().style.cursor = 'pointer';
        });
        globe.on('mouseleave', 'station-points', () => {
          globe.getCanvas().style.cursor = '';
        });
      });
      // 视角放大或倾斜后淡出装饰环，避免遮挡地图内容。
      globe.on('move', () => setHudVisible(globe.getZoom() <= 1.35 && globe.getPitch() <= 20));
      /** 页面卸载时释放地图实例。 */
      return () => {
        pointsController.abort();
        mapReady.current = false;
        globe.remove();
        map.current = null;
      };
    },
    [],
  );

  useEffect(
    /** 主题变化时保留地球视角，只替换空间、辅助线和点位配色。 */
    () => {
      const globe = map.current;
      if (!globe || !mapReady.current || !globe.isStyleLoaded() || !resolvedTheme) return;
      applyGlobeTheme(globe, resolvedTheme === 'dark');
    },
    [resolvedTheme],
  );

  return (
    <div className="globe-page">
      <div ref={container} className="globe-map" role="img" aria-label="Interactive 3D earth with radio stations" />
      <div className="globe-brand"><span className="aether-eq" aria-hidden="true"><i /><i /><i /><i /></span> worldTuner</div>
      {pointsError && <div className="globe-error" role="status">
        {locale === 'zh' ? '电台点位暂时无法加载' : 'Station points unavailable'}
      </div>}
      <div className={`globe-hud${hudVisible ? '' : ' is-hidden'}`} aria-hidden="true">
        <div className="globe-hud__ring" />
        <div className="globe-hud__ring globe-hud__ring--dashed" />
        <div className="globe-hud__ring globe-hud__ring--inner" />
        <span className="globe-hud__label globe-hud__label--n">N</span>
        <span className="globe-hud__label globe-hud__label--s">S</span>
        <span className="globe-hud__label globe-hud__label--w">W</span>
        <span className="globe-hud__label globe-hud__label--e">E</span>
      </div>
    </div>
  );
}
