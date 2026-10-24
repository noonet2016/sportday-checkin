export default function ProgressBar({ value, tone = "violet", label }: { value: number; tone?: "violet" | "emerald" | "amber" | "rose"; label?: string }) {
  const color = { violet: "bg-violet-700", emerald: "bg-emerald-600", amber: "bg-amber-500", rose: "bg-rose-600" }[tone];
  return <div role="progressbar" aria-label={label ?? "ความคืบหน้า"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, value))} className="h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${color} transition-[width] duration-200 motion-reduce:transition-none`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
