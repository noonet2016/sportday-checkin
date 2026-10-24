import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { compareRooms } from "@/lib/event";
import StaffNav from "../StaffNav";
import UsersManager from "../UsersManager";
export const dynamic="force-dynamic";
export default async function StaffUsers(){const session=await getSession("staff");if(!session)redirect("/staff/login");if(session.role!=="admin")redirect("/staff");const [users,rooms]=await Promise.all([prisma.staff.findMany({select:{id:true,username:true,displayName:true,role:true,lineDisplayName:true,lineUserId:true,rooms:{select:{classLevel:true,room:true}}},orderBy:{username:"asc"}}),prisma.student.findMany({where:{house:"purple"},distinct:["classLevel","room"],select:{classLevel:true,room:true,program:true}})]);rooms.sort(compareRooms);return <main className="screen gap-3 bg-slate-50" style={{maxWidth:"70rem",alignContent:"start"}}><StaffNav active="users"/><section className="grid gap-3"><header className="flex items-center justify-between gap-2"><h1 className="text-xl font-bold">จัดการครูและผู้ดูแล</h1></header><UsersManager users={users.map(({lineUserId,...u})=>({...u,lineLinked:Boolean(lineUserId)}))} rooms={rooms}/></section></main>}
