// Session = signed, httpOnly cookie (HMAC-SHA256 with SESSION_SECRET). No external session store.
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "sportday_checkin_session";
const SESSION_AGE = 60 * 60 * 12;

function secret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type Role = "student" | "staff";
export type Session = { role: Role; id: string } | null;

export async function createSession(role: Role, id: string): Promise<void> {
  const exp = Date.now() + SESSION_AGE * 1000;
  const value = Buffer.from(JSON.stringify({ role, id, exp })).toString("base64url");
  const store = await cookies();
  store.set(COOKIE, `${value}.${sign(value)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_AGE });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [value, signature] = token.split(".");
  if (!value || !signature || sign(value) !== signature) return null;
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString());
    if (!data.exp || Date.now() > data.exp || (data.role !== "student" && data.role !== "staff")) return null;
    return { role: data.role, id: data.id };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<NonNullable<Session>> {
  const session = await getSession();
  if (!session) throw new Error("Authentication required");
  return session;
}
