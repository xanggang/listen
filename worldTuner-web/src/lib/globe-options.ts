// 显式固定底图版本，避免不同 SDK 的 SATELLITE 别名指向不同影像样式。
export const GLOBE_STYLE_URL = 'https://api.maptiler.com/maps/satellite-v4/style.json';

/**
 * 创建与 Android 地球一致的卫星影像、DEM 和初始视角配置。
 * 每次返回独立对象；容器与主题空间色由页面注入，主题切换不重建或替换底图。
 */
export function createGlobeOptions() {
  return {
    style: GLOBE_STYLE_URL,
    projection: 'globe' as const,
    terrain: true,
    terrainExaggeration: 1.35,
    center: [20, 25] as [number, number],
    zoom: 0.9,
    minZoom: -1,
    maxZoom: 15,
    maxPitch: 85,
    halo: true,
    antialias: true,
    navigationControl: false as const,
    geolocateControl: false as const,
    terrainControl: false,
  };
}
