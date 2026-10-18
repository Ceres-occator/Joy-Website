'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, ExternalLink, Compass } from 'lucide-react';
import { MapSkeleton } from '@/components/ui/Skeleton';

interface OpenFreeMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  title?: string;
  address?: string;
  heightClass?: string;
  /** When true (in Admin Manage Rooms), clicking the map or dragging the pin updates coordinates */
  editable?: boolean;
  onLocationChange?: (lat: number, lng: number, zoom: number) => void;
}

const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';

const OPENFREEMAP_LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

declare global {
  interface Window {
    maplibregl?: any;
  }
}

function loadMapLibre(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window unavailable'));
    if (window.maplibregl) return resolve(window.maplibregl);

    if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MAPLIBRE_CSS;
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector(`script[src="${MAPLIBRE_JS}"]`) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.maplibregl));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.onload = () => resolve(window.maplibregl);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function OpenFreeMap({
  latitude = 7.0915,
  longitude = 125.5826,
  zoom = 16,
  title = "Joy's Events and Party Place",
  address = 'Ma-a, Davao City, Philippines, 8000',
  heightClass = 'h-72',
  editable = false,
  onLocationChange,
}: OpenFreeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const safeLat = Number.isFinite(Number(latitude)) ? Number(latitude) : 7.0915;
  const safeLng = Number.isFinite(Number(longitude)) ? Number(longitude) : 125.5826;
  const safeZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : 16;

  useEffect(() => {
    let cancelled = false;

    loadMapLibre()
      .then((maplibregl) => {
        if (cancelled || !containerRef.current || !maplibregl) return;

        const isDark = document.documentElement.classList.contains('dark');
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: isDark ? OPENFREEMAP_DARK_STYLE : OPENFREEMAP_LIGHT_STYLE,
          center: [safeLng, safeLat],
          zoom: safeZoom,
          attributionControl: true,
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
          `<div style="font-family:sans-serif;padding:4px 6px;color:#1e293b;">
            <strong style="font-size:12px;display:block;">${title}</strong>
            <span style="font-size:11px;color:#475569;">${address || ''}</span>
          </div>`
        );

        const marker = new maplibregl.Marker({
          color: '#10b981',
          draggable: editable,
        })
          .setLngLat([safeLng, safeLat])
          .setPopup(popup)
          .addTo(map);

        if (editable && onLocationChange) {
          marker.on('dragend', () => {
            const lngLat = marker.getLngLat();
            onLocationChange(
              Number(lngLat.lat.toFixed(6)),
              Number(lngLat.lng.toFixed(6)),
              Math.round(map.getZoom())
            );
          });

          map.on('click', (e: any) => {
            marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
            onLocationChange(
              Number(e.lngLat.lat.toFixed(6)),
              Number(e.lngLat.lng.toFixed(6)),
              Math.round(map.getZoom())
            );
          });
        }

        map.on('load', () => {
          if (!cancelled) setReady(true);
        });

        mapRef.current = map;
        markerRef.current = marker;
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    const handleThemeChange = (e: any) => {
      if (mapRef.current) {
        const dark = e?.detail?.dark ?? document.documentElement.classList.contains('dark');
        mapRef.current.setStyle(dark ? OPENFREEMAP_DARK_STYLE : OPENFREEMAP_LIGHT_STYLE);
      }
    };

    window.addEventListener('joy-theme-change', handleThemeChange);

    return () => {
      cancelled = true;
      window.removeEventListener('joy-theme-change', handleThemeChange);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Keep marker and center synced when props change externally
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLngLat([safeLng, safeLat]);
      mapRef.current.flyTo({ center: [safeLng, safeLat], zoom: safeZoom, duration: 600 });
    }
  }, [safeLat, safeLng, safeZoom]);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${safeLat},${safeLng}`;

  return (
    <div className="neu-card-sm p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="neu-inset-sm p-2 text-emerald-600">
            <MapPin className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-xs font-extrabold text-slate-800">{title}</h4>
            <p className="text-[11px] text-slate-500">{address || 'Ma-a, Davao City, Philippines'}</p>
          </div>
        </div>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="neu-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-emerald-700"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Directions
        </a>
      </div>

      <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden neu-inset-sm`}>
        {!ready && !loadError && (
          <div className="absolute inset-0 z-10">
            <MapSkeleton heightClass={heightClass} />
          </div>
        )}
        {loadError ? (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500">
            <Compass className="w-6 h-6 text-emerald-600 mb-2" />
            <p className="font-bold text-slate-700">{title}</p>
            <p className="mt-0.5">{address}</p>
            <p className="font-mono text-[11px] mt-1">
              {safeLat.toFixed(5)}, {safeLng.toFixed(5)}
            </p>
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full" />
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span>
          Coordinates:{' '}
          <strong className="font-mono text-slate-700">
            {safeLat.toFixed(5)}, {safeLng.toFixed(5)}
          </strong>
        </span>
        {editable ? (
          <span className="text-emerald-700 font-bold">
            Tip: Click map or drag pin to set exact location
          </span>
        ) : (
          <span>Powered by OpenFreeMap</span>
        )}
      </div>
    </div>
  );
}

