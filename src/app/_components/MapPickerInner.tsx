"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPickerProps, MapPoint } from "./MapPicker";
import { isThailandPoint, parseMapLocation } from "@/lib/map-location";

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
  const [basemap, setBasemap] = useState<"street" | "satellite">("satellite");
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<{ lat: string; lon: string; display_name: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");

  function applyPoint(point: { lat: number; lng: number }) {
    onChange({ ...value, ...point });
    setPasteMessage(isThailandPoint(point) ? "" : "ตำแหน่งอยู่นอกกรอบประเทศไทย โปรดตรวจสอบอีกครั้ง");
  }

  // Not a <form>: this picker renders inside the settings <form>, and nested forms make Enter submit the outer one.
  async function searchPlaces() {
    if (!search.trim() || searching) return;
    setSearching(true); setSearchMessage(""); setResults([]);
    try {
      const response = await fetch(`/staff/api/geocode?q=${encodeURIComponent(search.trim())}`);
      if (!response.ok) throw new Error("network");
      const data = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
      setResults(data);
      if (!data.length) setSearchMessage("ไม่พบสถานที่ ลองใช้ชื่ออื่น หรือวางพิกัดจาก Google Maps");
    } catch { setSearchMessage("ค้นหาไม่สำเร็จ โปรดลองอีกครั้ง"); }
    finally { setSearching(false); }
  }

  async function applyPastedLocation() {
    let point = parseMapLocation(paste);
    if (!point) {
      try {
        const url = new URL(paste.trim());
        if (url.hostname === "maps.app.goo.gl" || url.hostname === "goo.gl") {
          const response = await fetch(`/staff/api/maps-resolve?url=${encodeURIComponent(url.toString())}`);
          if (!response.ok) throw new Error();
          const data = await response.json() as { url: string };
          point = parseMapLocation(data.url);
        }
      } catch { /* show the same clear parse error below */ }
    }
    if (!point) { setPasteMessage("ไม่พบพิกัดที่ถูกต้อง กรุณาวางพิกัดหรือลิงก์ Google Maps ที่มีตำแหน่ง"); return; }
    applyPoint(point);
  }

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
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <label className="block text-sm font-semibold text-slate-800">ค้นหาสถานที่
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900" placeholder="ชื่อสถานที่ในประเทศไทย" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchPlaces(); } }} />
        </label>
        <button type="button" onClick={() => void searchPlaces()} disabled={searching} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400">{searching ? "กำลังค้นหา…" : "ค้นหา"}</button>
        {searchMessage && <p role="status" className="break-words text-sm text-slate-700">{searchMessage}</p>}
        {results.length > 0 && <ul className="max-h-64 space-y-2 overflow-y-auto">{results.map((result, index) => <li key={`${result.lat}:${result.lon}:${index}`}><button type="button" onClick={() => { applyPoint({ lat: Number(result.lat), lng: Number(result.lon) }); setSearchMessage(""); }} className="w-full whitespace-normal break-words rounded-lg border border-slate-200 p-3 text-left text-sm text-slate-800 hover:bg-emerald-50">{result.display_name}</button></li>)}</ul>}
      </div>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <label className="block text-sm font-semibold text-slate-800">วางพิกัดหรือลิงก์จาก Google Maps
          <input value={paste} onChange={(event) => setPaste(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void applyPastedLocation(); } }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900" />
        </label>
        <button type="button" onClick={applyPastedLocation} className="w-full rounded-lg bg-violet-700 px-4 py-2.5 font-semibold text-white hover:bg-violet-800">ใช้ตำแหน่งนี้</button>
        {pasteMessage && <p role="status" className="break-words text-sm text-amber-800">{pasteMessage}</p>}
      </div>
      <div className="relative isolate z-0 h-[60vh] min-h-[420px] max-h-[720px] overflow-hidden rounded-xl border border-cyan-500/25 bg-slate-950 shadow-inner">
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
            applyPoint({ lat: next.lat, lng: next.lng });
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
