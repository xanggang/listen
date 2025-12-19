'use client';

import React, { useRef, useEffect } from 'react';
import { Map, MapStyle, config, Popup } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import mapData from '@/../public/data.json'

interface MapProps {
  onChange?: (data: any) => void;
}

const MapComponent: React.FC<MapProps> = ({ onChange }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);

  useEffect(() => {
    if (map.current) return; // stops map from intializing more than once

    config.apiKey = '5dPy611BtAufNGOyAaVt';

    const initialState = { lng: 139.753, lat: 35.6844, zoom: 1 };

    const res = mapData.data

    if (!mapContainer.current) return;

    map.current = new Map({
      container: mapContainer.current,
      style: MapStyle.SATELLITE,
      center: [initialState.lng, initialState.lat],
      zoom: initialState.zoom
    });

    map.current.on('load', async () => {
      if (!map.current) return;

      map.current.addSource('places', {
        'type': 'geojson',
        'data': {
          'type': 'FeatureCollection',
          features: res.map((item, index) => {
            return {
              id: index,
              'type': 'Feature',
              'properties': {
                'description': JSON.stringify(item),
                'icon': 'green-dot',
              },
              'geometry': {
                'type': 'Point',
                'coordinates': [item.geoLong, item.geoLat]
              }
            }
          })
        }
      });

      function svgStringToImageSrc(svgString: string) {
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      }

      const pin1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="5" fill="#69db7c"/></svg>`;

      const svgPinImage = new Image(6, 6);

      svgPinImage.onload = () => {
        if (map.current) {
           // check if image already exists to avoid error on strict mode re-runs if cleanup missed
           if (!map.current.hasImage('pin1')) {
              map.current.addImage('pin1', svgPinImage);
           }
        }
      }

      svgPinImage.src = svgStringToImageSrc(pin1);

      map.current.addLayer({
        'id': 'places',
        'type': 'symbol',
        'source': 'places',
        'layout': {
          'icon-image': 'pin1',
          'icon-overlap': 'always',
          'icon-size': 1
        }
      });

      // Create a popup, but don't add it to the map yet.
      const popup = new Popup({
        closeButton: false,
        closeOnClick: false
      });

      map.current.on('click', 'places', function (e) {
        if (!map.current) return;

        // @ts-ignore
        const coordinates = e.features[0].geometry.coordinates.slice();
        // @ts-ignore
        const description = e.features[0].properties.description;
        const json = JSON.parse(description);

        // 移动地图中心点到点击位置
        map.current.flyTo({
          center: coordinates,
          zoom: 5,
          speed: 0.8
        });

        if (onChange) {
          onChange(json);
        }

        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        console.log(coordinates);

        // Populate the popup and set its coordinates
        // based on the feature found.
        popup.setLngLat(coordinates).setHTML(`<div>${json.name}</div>`).addTo(map.current);
      });

      // Cursor pointer on hover
      map.current.on('mouseenter', 'places', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'places', () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
      });
    });

    return () => {
      // Cleanup
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    }
  }, [onChange]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute w-full h-full" />
    </div>
  );
}

export default React.memo(MapComponent);
