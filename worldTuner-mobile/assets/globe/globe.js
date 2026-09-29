// 将 3D 地球的渲染与 Flutter 电台、播放器业务隔离。
(function () {
  'use strict';

  let map = null;
  let ready = false;
  let pendingStations = [];
  let activeStation = null;
  let pulseFrame = null;
  let lastPulseTime = 0;
  let theme = 'dark';

  // 只通过固定的 JavaScript channel 回传地图状态与选中的电台 id。
  function send(type, fields = {}) {
    if (!window.AetherBridge) return;
    window.AetherBridge.postMessage(JSON.stringify({ type, ...fields }));
  }

  // 创建基于真实卫星影像和高程 DEM 的可旋转地球。
  function initialize(config) {
    if (map) return;
    if (!window.maptilersdk || !config || typeof config.key !== 'string') {
      send('error');
      return;
    }
    theme = config.theme === 'light' ? 'light' : 'dark';
    document.body.dataset.theme = theme;
    maptilersdk.config.apiKey = config.key;
    try {
      map = new maptilersdk.Map({
        container: 'globe',
        style: maptilersdk.MapStyle.SATELLITE,
        projection: 'globe',
        terrain: true,
        terrainExaggeration: 1.35,
        center: [20, 25],
        zoom: 0.9,
        minZoom: -1,
        maxZoom: 15,
        maxPitch: 85,
        touchZoomRotate: true,
        touchPitch: true,
        space: { color: theme === 'dark' ? '#0e1321' : '#f8fafc' },
        halo: true,
        navigationControl: false,
        geolocateControl: false,
        terrainControl: false,
        attributionControl: true,
        antialias: true,
      });
      map.on('load', onMapLoaded);
      map.on('zoom', updateHudVisibility);
      map.on('pitch', updateHudVisibility);
    } catch {
      send('error');
    }
  }

  // 底图就绪后注册经纬辅助线和逐个电台的点位图层。
  function onMapLoaded() {
    map.addSource('graticule', {
      type: 'geojson',
      data: createGraticule(),
    });
    map.addLayer({
      id: 'graticule-lines',
      type: 'line',
      source: 'graticule',
      maxzoom: 3,
      paint: {
        'line-color': theme === 'dark' ? '#00f2fe' : '#0284c7',
        'line-opacity': theme === 'dark' ? 0.24 : 0.28,
        'line-width': 0.7,
      },
    });
    map.addSource('stations', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'station-points',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-color': theme === 'dark' ? '#00f2fe' : '#0284c7',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.2, 5, 4.5, 10, 7, 15, 9],
        'circle-opacity': 0.82,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 0.5,
      },
    });
    map.addSource('active-station', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'active-station-halo',
      type: 'circle',
      source: 'active-station',
      paint: {
        'circle-color': theme === 'dark' ? '#00f2fe' : '#0284c7',
        'circle-radius': 10,
        'circle-opacity': 0.45,
        'circle-blur': 0.35,
      },
    });
    map.addLayer({
      id: 'active-station-core',
      type: 'circle',
      source: 'active-station',
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': 6,
        'circle-stroke-color': theme === 'dark' ? '#00f2fe' : '#0284c7',
        'circle-stroke-width': 2,
      },
    });
    map.on('click', onStationClick);
    ready = true;
    updateHudVisibility();
    setStations(pendingStations);
    setActiveStation(activeStation);
    send('ready');
  }

  // 按真实经纬度生成稀疏网格，线段随地球转动并由球体遮挡背面。
  function createGraticule() {
    const features = [];
    for (let longitude = -180; longitude <= 180; longitude += 30) {
      const coordinates = [];
      for (let latitude = -85; latitude <= 85; latitude += 5) {
        coordinates.push([longitude, latitude]);
      }
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates } });
    }
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      const coordinates = [];
      for (let longitude = -180; longitude <= 180; longitude += 5) {
        coordinates.push([longitude, latitude]);
      }
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates } });
    }
    return { type: 'FeatureCollection', features };
  }

  // 放大或倾斜后淡出固定环线，避免装饰与真实地理位置错位。
  function updateHudVisibility() {
    const hud = document.getElementById('globe-hud');
    if (!hud || !map) return;
    hud.classList.toggle('is-hidden', map.getZoom() > 1.35 || map.getPitch() > 20);
  }

  // 在点位中心周围扩大触控范围，并优先选取离手指最近的可见电台。
  function onStationClick(event) {
    const point = event.point;
    const stationTouchRadius = map.getZoom() >= 5 ? 22 : 14;
    const bounds = [
      [point.x - stationTouchRadius, point.y - stationTouchRadius],
      [point.x + stationTouchRadius, point.y + stationTouchRadius],
    ];
    const features = map.queryRenderedFeatures(bounds, { layers: ['active-station-core', 'station-points'] });
    let closest = null;
    let closestDistance = stationTouchRadius * stationTouchRadius;
    for (const feature of features) {
      const coordinates = feature.geometry && feature.geometry.coordinates;
      if (!Array.isArray(coordinates)) continue;
      const projected = map.project(coordinates);
      const distance = (projected.x - point.x) ** 2 + (projected.y - point.y) ** 2;
      if (distance > closestDistance) continue;
      closest = feature;
      closestDistance = distance;
    }
    const id = Number(closest && closest.properties && closest.properties.id);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    send('select', { id });
  }

  // 将全部有效经纬度逐个更新为 GeoJSON，不合并相邻或重合的电台。
  function setStations(stations) {
    if (!Array.isArray(stations)) return;
    pendingStations = stations;
    if (!ready) return;
    const features = stations
      .filter((station) => Number.isSafeInteger(station.id) &&
        Number.isFinite(station.latitude) && Number.isFinite(station.longitude))
      .map((station) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [station.longitude, station.latitude],
        },
        properties: { id: station.id },
      }));
    map.getSource('stations').setData({ type: 'FeatureCollection', features });
  }

  // 播放点位随状态移动或清空；坐标来自 Flutter 已校验的电台和地图快照。
  function setActiveStation(station) {
    const valid = station && Number.isSafeInteger(station.id) && station.id > 0 &&
      Number.isFinite(station.latitude) && station.latitude >= -90 && station.latitude <= 90 &&
      Number.isFinite(station.longitude) && station.longitude >= -180 && station.longitude <= 180;
    activeStation = valid ? station : null;
    if (!ready) return;
    const features = activeStation ? [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [activeStation.longitude, activeStation.latitude] },
      properties: { id: activeStation.id },
    }] : [];
    map.getSource('active-station').setData({ type: 'FeatureCollection', features });
    if (activeStation && pulseFrame === null) {
      pulseFrame = requestAnimationFrame(animatePlayingPulse);
    } else if (!activeStation && pulseFrame !== null) {
      cancelAnimationFrame(pulseFrame);
      pulseFrame = null;
    }
  }

  // 仅播放时更新单个光圈，约 30 帧每秒；底图和其他电台点位不参与动画。
  function animatePlayingPulse(timestamp) {
    if (!ready || !activeStation) {
      pulseFrame = null;
      return;
    }
    if (timestamp - lastPulseTime >= 32) {
      const progress = (timestamp % 1800) / 1800;
      map.setPaintProperty('active-station-halo', 'circle-radius', 9 + progress * 18);
      map.setPaintProperty('active-station-halo', 'circle-opacity', (1 - progress) * 0.55);
      lastPulseTime = timestamp;
    }
    pulseFrame = requestAnimationFrame(animatePlayingPulse);
  }

  // 外观设置改变时更新球体周围的空间色和电台点位色。
  function setTheme(value) {
    theme = value === 'light' ? 'light' : 'dark';
    document.body.dataset.theme = theme;
    if (!ready) return;
    map.setSpace({ color: theme === 'dark' ? '#0e1321' : '#f8fafc' });
    const color = theme === 'dark' ? '#00f2fe' : '#0284c7';
    map.setPaintProperty('graticule-lines', 'line-color', color);
    map.setPaintProperty('graticule-lines', 'line-opacity', theme === 'dark' ? 0.24 : 0.28);
    map.setPaintProperty('station-points', 'circle-color', color);
    map.setPaintProperty('active-station-halo', 'circle-color', color);
    map.setPaintProperty('active-station-core', 'circle-stroke-color', color);
  }

  window.AetherGlobe = { initialize, setStations, setActiveStation, setTheme };
})();
