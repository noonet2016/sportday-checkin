import { periodOrder } from "@/lib/event";
import SlotTimesForm from "./SlotTimesForm";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import SettingsForm from "../SettingsForm";
import { formatThaiDateFull } from "@/lib/time";
import StaffNav from "../StaffNav";
export const dynamic="force-dynamic";
export default async function Settings(){const s=await getSession("staff");if(!s)redirect("/staff/login");if(s.role!=="admin")redirect("/staff");const settings=await prisma.systemSetting.findMany({where:{key:{in:["geofence_lat","geofence_lng","geofence_radius_m"]}}});const get=(k:string,d:number)=>Number(settings.find(v=>v.key===k)?.value??d);const days=await prisma.eventDay.findMany({include:{slots:true},orderBy:{date:"asc"}});return <main className="screen gap-3 bg-slate-50 pb-24" style={{maxWidth:"70rem",alignContent:"start"}}><StaffNav active="settings"/><h1 className="text-xl font-bold">ตั้งค่าพื้นที่เช็กชื่อ</h1><section className="card border-slate-200 p-3 sm:p-4"><h2 className="text-base font-semibold">แผนที่และตำแหน่ง</h2><SettingsForm initial={{lat:get("geofence_lat",13.7563),lng:get("geofence_lng",100.5018),radiusM:get("geofence_radius_m",300)}}/></section><section className="card border-slate-200 p-3 sm:p-4"><h2 className="text-base font-semibold">ช่วงเวลาเช็คชื่อเข้าร่วมกิจกรรม</h2><SlotTimesForm days={days.map(d=>({key:String(d.id),label:formatThaiDateFull(d.date),slots:[...d.slots].sort((a,b)=>periodOrder(a.period)-periodOrder(b.period)).map(x=>({id:x.id,period:x.period as "morning"|"afternoon",open:x.opensAt.toISOString().slice(11,16),close:x.closesAt.toISOString().slice(11,16)}))}))}/></section></main>}
