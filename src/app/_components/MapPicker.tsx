"use client";

import dynamic from "next/dynamic";

export type MapPoint = { lat: number; lng: number; radiusM: number };

export type MapPickerProps = {
  value: MapPoint;
  onChange: (next: MapPoint) => void;
  inputNames?: { lat: string; lng: string; radiusM: string };
};

// Leaflet reads `window` while it initializes. Keeping the implementation in a
// client-only chunk prevents it from ever being evaluated during Next SSR.
const MapPickerInner = dynamic(() => import("./MapPickerInner"), { ssr: false });

export default function MapPicker(props: MapPickerProps) {
  return <MapPickerInner {...props} />;
}
