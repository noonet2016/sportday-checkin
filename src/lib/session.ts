// Session = signed, httpOnly cookie (HMAC-SHA256 with SESSION_SECRET). No external session store.
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "sportday_checkin_session";
const STAFF_COOKIE = "sportday_staff_session";
const SESSION_AGE = 60 * 60 * 12;

function secret(): string {
  const configured = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!configured || configured.length < 32)) throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  return configured || "dev-insecure-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type Role = "student" | "staff" | "admin";
export type Session = { role: Role; id: string } | null;

export async function createSession(role: Role, id: string): Promise<void> {
  const exp = Date.now() + SESSION_AGE * 1000;
  const value = Buffer.from(JSON.stringify({ role, id, exp })).toString("base64url");
  const store = await cookies();
  store.set(role === "student" ? COOKIE : STAFF_COOKIE, `${value}.${sign(value)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_AGE });
}

export async function destroySession(): Promise<void> {
  const store = await cookies(); store.delete(COOKIE); store.delete(STAFF_COOKIE);
}

export async function getSession(expected?: "student" | "staff"): Promise<Session> {
  const store = await cookies();
  const token = store.get(expected === "staff" ? STAFF_COOKIE : COOKIE)?.value;
  if (!token) return null;
  const [value, signature] = token.split(".");
  if (!value || !signature) return null;
  const signedDigest = Buffer.from(sign(value)); const supplied = Buffer.from(signature);
  if (signedDigest.length !== supplied.length || !crypto.timingSafeEqual(signedDigest, supplied)) return null;
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString());
    if (!data.exp || Date.now() > data.exp || (data.role !== "student" && data.role !== "staff" && data.role !== "admin") || (expected === "student" && data.role !== "student") || (expected === "staff" && data.role === "student")) return null;
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

export async function requireStaff(admin = false) {
  const session = await getSession("staff");
  if (!session || (admin && session.role !== "admin")) throw new Error("Staff authorization required");
  return session;
}
