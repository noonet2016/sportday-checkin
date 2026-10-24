"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, requireStaff } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { cancelStaffRecord, clearCheckinFlag, deleteCheckinRecord, requestReview, resolveReview, staffRecordCheckin, updateStaffRecord } from "@/lib/checkin-core";
import { nowInBangkok } from "@/lib/time";
import { allowedRooms } from "@/lib/staff-access";

export async function loginStaff(form: FormData) {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password || username.length > 100 || password.length > 200) redirect("/staff/login?error=1");
  const staff = await prisma.staff.findUnique({ where: { username }, select: { id: true, passwordHash: true, role: true } });
  if (!staff || !(await bcrypt.compare(password, staff.passwordHash)) || !["admin", "staff"].includes(staff.role)) redirect("/staff/login?error=1");
  await createSession(staff.role as "admin" | "staff", String(staff.id)); redirect("/staff");
}

export async function logoutStaff() { await destroySession(); redirect("/staff/login"); }

export async function manualRecord(form: FormData) {
  const actor = await requireStaff();
  const studentId = Number(form.get("studentId")); const slotId = Number(form.get("slotId"));
  const role = String(form.get("role")); const reason = String(form.get("reason") ?? "").trim(); const sport = String(form.get("sport") ?? "").trim();
  if (!Number.isSafeInteger(studentId) || !Number.isSafeInteger(slotId) || !["compete", "cheer"].includes(role) || reason.length < 3 || reason.length > 500) throw new Error("ข้อมูลการเช็คชื่อแทนไม่ถูกต้อง");
  const rooms = await allowedRooms(actor);
  const result = await staffRecordCheckin({ staffId: Number(actor.id), studentId, slotId, role, sport, reason, now: nowInBangkok().wallClock, allowedRooms: rooms, isAdmin: actor.role === "admin" });
  if (!result.ok) throw new Error(result.message);
  revalidatePath("/staff"); revalidatePath("/staff/report");
}

export async function editRecord(form: FormData) {
  const actor = await requireStaff();
  const recordId = Number(form.get("recordId")); const role = String(form.get("role")); const reason = String(form.get("reason") ?? ""); const sport = String(form.get("sport") ?? "");
  const result = await updateStaffRecord({ staffId: Number(actor.id), isAdmin: actor.role === "admin", allowedRooms: await allowedRooms(actor), recordId, role, sport, reason });
  if (!result.ok) throw new Error(result.message);
  revalidatePath("/staff"); revalidatePath("/staff/report");
}

export async function cancelRecord(form: FormData) {
  const actor = await requireStaff();
  const result = await cancelStaffRecord({ staffId: Number(actor.id), isAdmin: actor.role === "admin", allowedRooms: await allowedRooms(actor), recordId: Number(form.get("recordId")) });
  if (!result.ok) throw new Error(result.message);
  revalidatePath("/staff"); revalidatePath("/staff/report");
}

export async function requestRecordReview(form: FormData) {
  const actor = await requireStaff();
  const result = await requestReview({ staffId: Number(actor.id), isAdmin: actor.role === "admin", allowedRooms: await allowedRooms(actor), recordId: Number(form.get("recordId")), reason: String(form.get("reason") ?? ""), now: nowInBangkok().wallClock });
  if (!result.ok) throw new Error(result.message);
  revalidatePath("/staff");
}

export async function resolveRecordReview(form: FormData) {
  const actor = await requireStaff(true); const id = Number(form.get("recordId"));
  if (!Number.isSafeInteger(id)) throw new Error("ข้อมูลรายการไม่ถูกต้อง");
  await resolveReview({ staffId: Number(actor.id), role: actor.role, recordId: id }); revalidatePath("/staff");
}

export async function clearFlag(form: FormData) {
  const actor = await requireStaff(true); const id = Number(form.get("recordId"));
  if (!Number.isSafeInteger(id)) throw new Error("ข้อมูลรายการไม่ถูกต้อง");
  await clearCheckinFlag({ staffId: Number(actor.id), role: actor.role, recordId: id }); revalidatePath("/staff");
}

export async function deleteRecord(form: FormData) {
  const actor = await requireStaff(true); const id = Number(form.get("recordId"));
  if (!Number.isSafeInteger(id)) throw new Error("ข้อมูลรายการไม่ถูกต้อง");
  await deleteCheckinRecord({ staffId: Number(actor.id), role: actor.role, recordId: id, reason: String(form.get("reason") ?? "") }); revalidatePath("/staff"); revalidatePath("/staff/report");
}

export async function saveSettings(form: FormData) {
  const actor = await requireStaff(true); const lat = Number(form.get("lat")); const lng = Number(form.get("lng")); const radius = Number(form.get("radius"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isInteger(radius) || radius < 10 || radius > 10000) throw new Error("ข้อมูลตำแหน่งและรัศมีไม่ถูกต้อง");
  await prisma.$transaction(async tx => { for (const [key, value] of [["geofence_lat", lat], ["geofence_lng", lng], ["geofence_radius_m", radius]] as const) await tx.systemSetting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } }); await writeAudit(tx, `admin:${actor.id}`, "geofence_updated", "SystemSetting", "geofence", { lat, lng, radius }); }); revalidatePath("/staff/settings");
}

export async function createStaff(form: FormData) {
  const actor = await requireStaff(true);
  const username=String(form.get("username")??"").trim().toLowerCase(), displayName=String(form.get("displayName")??"").trim(), password=String(form.get("password")??""), role=String(form.get("role")??"staff");
  if(!/^[a-z0-9._-]{2,100}$/.test(username)||!displayName||displayName.length>150||password.length<8||password.length>200||!(["staff","admin"].includes(role))) throw new Error("ข้อมูลเจ้าหน้าที่ไม่ถูกต้อง");
  const hash=await bcrypt.hash(password,12);
  await prisma.$transaction(async tx=>{const user=await tx.staff.create({data:{username,displayName,passwordHash:hash,role}});await writeAudit(tx,`admin:${actor.id}`,"staff_created","Staff",String(user.id),{username,role});});
  revalidatePath("/staff/users");
}

export async function resetStaffPassword(form: FormData) {
 const actor=await requireStaff(true), id=Number(form.get("staffId")), password=String(form.get("password")??""); if(!Number.isSafeInteger(id)||password.length<8||password.length>200) throw new Error("ข้อมูลการรีเซ็ตรหัสผ่านไม่ถูกต้อง"); const hash=await bcrypt.hash(password,12);
 await prisma.$transaction(async tx=>{await tx.staff.update({where:{id},data:{passwordHash:hash}});await writeAudit(tx,`admin:${actor.id}`,"staff_password_reset","Staff",String(id));});revalidatePath("/staff/users");
}

export async function saveStaffRooms(form: FormData) {
 const actor=await requireStaff(true), id=Number(form.get("staffId"));if(!Number.isSafeInteger(id)) throw new Error("ข้อมูลบัญชีเจ้าหน้าที่ไม่ถูกต้อง");
 const chosen=form.getAll("room").map(String).map(v=>{const [classLevel,room]=v.split("|");return {classLevel,room};});
 const known=await prisma.student.findMany({where:{house:"purple"},distinct:["classLevel","room"],select:{classLevel:true,room:true}});if(chosen.some(x=>!known.some(k=>k.classLevel===x.classLevel&&k.room===x.room))) throw new Error("ไม่พบห้องเรียนที่เลือก");
 await prisma.$transaction(async tx=>{await tx.staffRoom.deleteMany({where:{staffId:id}});if(chosen.length)await tx.staffRoom.createMany({data:chosen.map(r=>({staffId:id,...r}))});await writeAudit(tx,`admin:${actor.id}`,"staff_rooms_updated","Staff",String(id),{rooms:chosen});});revalidatePath("/staff/users");
}

export async function deleteStaff(form: FormData) {
 const actor=await requireStaff(true), id=Number(form.get("staffId"));if(!Number.isSafeInteger(id)) throw new Error("ข้อมูลบัญชีเจ้าหน้าที่ไม่ถูกต้อง");
 await prisma.$transaction(async tx=>{const target=await tx.staff.findUnique({where:{id},select:{role:true,username:true}});if(!target)throw new Error("ไม่พบบัญชีเจ้าหน้าที่");if(target.role==="admin"&&await tx.staff.count({where:{role:"admin"}})<=1)throw new Error("ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้");await writeAudit(tx,`admin:${actor.id}`,"staff_deleted","Staff",String(id),{username:target.username});await tx.staff.delete({where:{id}});});revalidatePath("/staff/users");
}
