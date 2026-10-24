import { periodLabel } from "@/lib/event";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import SettingsForm from "../SettingsForm";
import { formatWallClockTime, formatThaiDate } from "@/lib/time";
import StaffNav from "../StaffNav";
export const dynamic="force-dynamic";
export default async function Settings(){const s=await getSession("staff");if(!s)redirect("/staff/login");if(s.role!=="admin")redirect("/staff");const settings=await prisma.systemSetting.findMany({where:{key:{in:["geofence_lat","geofence_lng","geofence_radius_m"]}}});const get=(k:string,d:number)=>Number(settings.find(v=>v.key===k)?.value??d);const days=await prisma.eventDay.findMany({include:{slots:true},orderBy:{date:"asc"}});return <main className="screen" style={{maxWidth:"70rem"}}><StaffNav active="settings"/><section className="card"><h1>ตั้งค่าพื้นที่เช็กชื่อ</h1><SettingsForm initial={{lat:get("geofence_lat",13.7563),lng:get("geofence_lng",100.5018),radiusM:get("geofence_radius_m",300)}}/><h2>ช่วงเวลา (อ่านอย่างเดียว)</h2>{days.map(d=><p key={d.id}>{formatThaiDate(d.date, { year: true })}: {d.slots.map(x=>`${periodLabel(x.period)} ${formatWallClockTime(x.opensAt)}–${formatWallClockTime(x.closesAt)}`).join(" · ")}</p>)}</section></main>}
