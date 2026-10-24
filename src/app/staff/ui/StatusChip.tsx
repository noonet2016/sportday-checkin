import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "muted" | "sport" | "cheer" | "primary";
const tones: Record<Tone, string> = {
  success: "bg-emerald-100 text-emerald-800", warning: "bg-amber-100 text-amber-900",
  danger: "bg-rose-100 text-rose-800", muted: "bg-slate-100 text-slate-600",
  sport: "bg-sky-100 text-sky-800", cheer: "bg-fuchsia-100 text-fuchsia-800", primary: "bg-violet-100 text-violet-900",
};
export default function StatusChip({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
