import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveSlotWindow } from "../src/lib/event";
import { haversineDistance } from "../src/lib/geo";
import { scoreSuspicion } from "../src/lib/spoof";
const url=process.env.DATABASE_URL;
if(!url) throw new Error("DATABASE_URL is required");
const parsed=new URL(url);
if(!["127.0.0.1","localhost","::1"].includes(parsed.hostname)||!parsed.pathname.includes("sportday_dev")) throw new Error("Refusing DB smoke test: development DB must be localhost sportday_dev");
const db=new PrismaClient({adapter:new PrismaMariaDb(url)});let studentId:number|undefined;let staffId:number|undefined;let settingKey="";
async function check(name:string,fn:()=>Promise<boolean>){const ok=await fn();console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)throw new Error(name)}
async function main(){const token=`smoke-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;settingKey=`smoke_${token}`;
try {
 const student=await db.student.create({data:{studentCode:token,firstName:"Smoke",lastName:"Test",classLevel:"TEST",room:"0",house:"purple",lineUserId:`line-${token}`}});studentId=student.id;
 const staff=await db.staff.create({data:{username:token,passwordHash:"not-a-login-hash",displayName:"Smoke Test",role:"admin"}});staffId=staff.id;
 const event=await db.eventDay.findUnique({where:{date:new Date(Date.UTC(2026,9,26))}});if(!event)throw new Error("seeded event day missing");const slot=await db.checkinSlot.findUnique({where:{eventDayId_period:{eventDayId:event.id,period:"morning"}}});if(!slot)throw new Error("seeded morning slot missing");
 process.env.DEV_NOW="2026-10-26T08:30:00";
 await check("DEV_NOW morning slot window",async()=>resolveSlotWindow(new Date(Date.UTC(2026,9,26,8,30))).state==="open");
 await check("temporary student and staff created",async()=>Boolean(await db.student.findUnique({where:{id:student.id}})&&await db.staff.findUnique({where:{id:staff.id}})));
 await check("database geofence settings writable",async()=>{await db.systemSetting.upsert({where:{key:settingKey},create:{key:settingKey,value:"300"},update:{value:"300"}});return (await db.systemSetting.findUnique({where:{key:settingKey}}))?.value==="300"});
 const center={lat:13.7563,lng:100.5018};await check("inside location accepts; outside rejected",async()=>haversineDistance(center.lat,center.lng,center.lat,center.lng)<=300&&haversineDistance(center.lat,center.lng,13.8,100.5)>300);
 await check("zero-jitter samples produce a suspicious flag",async()=>scoreSuspicion([1,2,3].map(()=>({lat:center.lat,lng:center.lng,accuracy:20,altitude:null,altitudeAccuracy:null,speed:null,heading:null,timestamp:Date.now()})),center.lat,center.lng,{name:"campus",...center}).suspicious);
 await db.$transaction(async tx=>{const record=await tx.checkinRecord.create({data:{studentId:student.id,slotId:slot.id,role:"compete",lat:center.lat,lng:center.lng,accuracy:20,source:"staff",staffId:staff.id,note:"smoke test"}});await tx.auditLog.create({data:{actor:`staff:${staff.id}`,action:"staff_checkin_created",targetType:"CheckinRecord",targetId:String(record.id)}})});
 await check("staff manual record and audit persisted",async()=>Boolean(await db.checkinRecord.findUnique({where:{studentId_slotId:{studentId:student.id,slotId:slot.id}}})&&await db.auditLog.findFirst({where:{actor:`staff:${staff.id}`,action:"staff_checkin_created"}})));
} finally {if(studentId)await db.checkinRecord.deleteMany({where:{studentId}});if(staffId)await db.auditLog.deleteMany({where:{actor:`staff:${staffId}`}});if(studentId)await db.student.delete({where:{id:studentId}});if(staffId)await db.staff.delete({where:{id:staffId}});if(settingKey)await db.systemSetting.deleteMany({where:{key:settingKey}});await db.$disconnect()}}
main().catch(e=>{console.log(`FAIL ${e instanceof Error?e.message:"database smoke test"}`);process.exitCode=1});
