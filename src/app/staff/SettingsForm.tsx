"use client";
import { useState } from "react";
import MapPicker, { type MapPoint } from "@/app/_components/MapPicker";
import { saveSettings } from "./actions";
export default function SettingsForm({ initial }: { initial: MapPoint }) { const [point,setPoint]=useState(initial); return <form action={saveSettings} className="grid gap-4"><MapPicker value={point} onChange={setPoint} inputNames={{lat:"lat",lng:"lng",radiusM:"radius"}}/><button className="primary">บันทึกตำแหน่งและรัศมี</button></form>; }
