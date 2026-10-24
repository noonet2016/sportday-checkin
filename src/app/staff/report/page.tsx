import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatDateInput } from "@/lib/time";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Report({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
 const session=await getSession("staff"); if(!session) redirect("/staff/login"); const {room}=await searchParams;
 const [students,days]=await Promise.all([prisma.student.findMany({where:{house:"purple",...(room?{room}:{})},select:{id:true,studentCode:true,prefix:true,firstName:true,lastName:true,classLevel:true,room:true,program:true},orderBy:[{classLevel:"asc"},{room:"asc"},{number:"asc"}] }),prisma.eventDay.findMany({include:{slots:{select:{id:true,period:true},orderBy:{period:"asc"}}},orderBy:{date:"asc"}})]);
 const ids=students.map(s=>s.id); const records=ids.length?await prisma.checkinRecord.findMany({where:{studentId:{in:ids}},select:{studentId:true,slotId:true}}):[]; const set=new Set(records.map(r=>`${r.studentId}:${r.slotId}`));
 return <main className="screen" style={{maxWidth:"90rem",alignContent:"start"}}><section className="card"><h1>รายงานการเช็กชื่อ</h1><Link href="/staff">← กลับหน้าหลัก</Link><form><label>ห้อง<input name="room" defaultValue={room??""} placeholder="ทุกห้อง"/></label><button className="primary">กรอง</button><a className="secondary" href={`/staff/report.csv${room?`?room=${encodeURIComponent(room)}`:""}`}>ดาวน์โหลด CSV</a></form><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>นักเรียน</th><th>ห้อง</th>{days.flatMap(d=>d.slots.map(s=><th key={s.id}>{formatDateInput(d.date)} {s.period==="morning"?"เช้า":"บ่าย"}</th>))}<th>รวม</th></tr></thead><tbody>{students.map(s=>{const done=days.flatMap(d=>d.slots).filter(slot=>set.has(`${s.id}:${slot.id}`)).length;return <tr key={s.id}><td>{s.studentCode} {s.prefix??""}{s.firstName} {s.lastName}</td><td>{s.classLevel}/{s.room} {s.program}</td>{days.flatMap(d=>d.slots.map(slot=><td key={slot.id}>{set.has(`${s.id}:${slot.id}`)?"✓":"—"}</td>))}<td>{done}/10</td></tr>})}</tbody></table></div><h2>สรุปรายวัน</h2>{days.map(d=><p key={d.id}>{formatDateInput(d.date)}: {d.slots.map(slot=>`${slot.period} ${records.filter(r=>r.slotId===slot.id).length}/${students.length}`).join(" · ")}</p>)}</section></main>;
}
