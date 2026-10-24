import type { Prisma, PrismaClient } from "@/generated/prisma/client";
type Db = PrismaClient | Prisma.TransactionClient;
export async function writeAudit(db: Db, actor: string, action: string, targetType: string, targetId: string, detail?: Prisma.InputJsonValue) {
  await db.auditLog.create({ data: { actor, action, targetType, targetId, detail } });
}
