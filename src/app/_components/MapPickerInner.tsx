"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPickerProps, MapPoint } from "./MapPicker";

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="width:28px;height:28px;border-radius:9999px;background:#06b6d4;border:3px solid white;box-shadow:0 2px 10px rgba(8,145,178,.7);display:grid;place-items:center;font-size:14px">📍</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function MapViewport({ value }: { value: MapPoint }) {
  const map = useMap();
  useEffect(() => {
    map.setView([value.lat, value.lng]);
  }, [map, value.lat, value.lng]);
  return null;
}

function MapEvents({ value, onChange }: Pick<MapPickerProps, "value" | "onChange">) {
  useMapEvents({ click: (event) => onChange({ ...value, lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

function numeric(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function MapPickerInner({ value, onChange, inputNames }: MapPickerProps) {
  const position = useMemo<[number, number]>(() => [value.lat, value.lng], [value.lat, value.lng]);
  const [basemap, setBasemap] = useState<"street" | "satellite">("street");
  const [locating, setLocating] = useState(false);

  function useCurrentPosition() {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { onChange({ ...value, lat: position.coords.latitude, lng: position.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative isolate z-0 h-72 overflow-hidden rounded-xl border border-cyan-500/25 bg-slate-950 shadow-inner">
        <MapContainer center={position} zoom={17} scrollWheelZoom className="h-full w-full">
          {basemap === "satellite" ? (
            <TileLayer key="sat" attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
          ) : (
            <TileLayer key="street" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          )}
          <MapViewport value={value} />
          <MapEvents value={value} onChange={onChange} />
          <Marker position={position} icon={markerIcon} draggable eventHandlers={{ dragend: (event) => {
            const next = event.target.getLatLng();
            onChange({ ...value, lat: next.lat, lng: next.lng });
          } }} />
          <Circle center={position} radius={value.radiusM} pathOptions={{ color: "#22d3ee", fillColor: "#06b6d4", fillOpacity: 0.15 }} />
        </MapContainer>
        <button
          type="button"
          onClick={() => setBasemap((current) => (current === "street" ? "satellite" : "street"))}
          className="absolute right-2 top-2 z-[1000] rounded-lg border border-white/20 bg-slate-900/85 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800"
        >
          {basemap === "street" ? "🛰️ ดาวเทียม" : "🗺️ แผนที่"}
        </button>
      </div>
      <button type="button" onClick={useCurrentPosition} disabled={locating} className="w-full rounded-lg bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-wait disabled:bg-sky-400">
        {locating ? "กำลังค้นหาตำแหน่ง…" : "📍 ดึงตำแหน่งปัจจุบัน"}
      </button>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-700">ละติจูด
          <input name={inputNames?.lat} type="number" step="any" value={value.lat} onChange={(event) => onChange({ ...value, lat: numeric(event.target.value, value.lat) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </label>
        <label className="text-xs font-semibold text-slate-700">ลองจิจูด
          <input name={inputNames?.lng} type="number" step="any" value={value.lng} onChange={(event) => onChange({ ...value, lng: numeric(event.target.value, value.lng) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </label>
        <label className="text-xs font-semibold text-slate-700">รัศมี (ม.)
          <input name={inputNames?.radiusM} type="number" min={1} step={1} value={value.radiusM} onChange={(event) => onChange({ ...value, radiusM: Math.max(1, Math.round(numeric(event.target.value, value.radiusM)) ) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </label>
      </div>
    </div>
  );
}
