import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
const cache = new Map<string, { at: number; data: unknown }>();
let lastRequest = 0;
let rateQueue: Promise<void> = Promise.resolve();

async function waitForNominatimSlot() {
  const slot = rateQueue.then(async () => {
    const delay = Math.max(0, 1000 - (Date.now() - lastRequest));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequest = Date.now();
  });
  rateQueue = slot.catch(() => {});
  await slot;
}

export async function GET(request: NextRequest) {
  const session = await getSession("staff");
  if (!session || session.role !== "admin") return new NextResponse("Unauthorized", { status: 401 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length > 200) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const cached = cache.get(q);
  if (cached && Date.now() - cached.at < 24 * 60 * 60 * 1000) return NextResponse.json(cached.data);
  await waitForNominatimSlot();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ format: "jsonv2", q, countrycodes: "th", "accept-language": "th", limit: "5" }).toString();
  try {
    const response = await fetch(url, { headers: { "User-Agent": "sportday-checkin/1.0 (school internal tool)" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
    const data: unknown = await response.json(); cache.set(q, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 }); }
}
