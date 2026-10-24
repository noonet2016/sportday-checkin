import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession("staff");
  if (!session || session.role !== "admin") return new NextResponse("Unauthorized", { status: 401 });
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  let current: URL;
  try { current = new URL(raw); } catch { return NextResponse.json({ error: "Invalid URL" }, { status: 400 }); }
  const allowed = (host: string) => host === "maps.app.goo.gl" || host === "goo.gl" || host === "google.com" || host.endsWith(".google.com") || host === "google.co.th" || host.endsWith(".google.co.th");
  if (!allowed(current.hostname)) return NextResponse.json({ error: "Unsupported URL" }, { status: 400 });
  try {
    for (let i = 0; i < 5; i++) {
      if (!allowed(current.hostname) || current.protocol !== "https:") return NextResponse.json({ error: "Unsupported redirect" }, { status: 400 });
      const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "sportday-checkin/1.0" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location"); if (!location) break;
        current = new URL(location, current); continue;
      }
      return NextResponse.json({ url: current.toString() });
    }
    return NextResponse.json({ url: current.toString() });
  } catch { return NextResponse.json({ error: "Could not resolve link" }, { status: 502 }); }
}
