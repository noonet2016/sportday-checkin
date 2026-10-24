"use client";
import { useState } from "react";
import ChoiceWithOther from "@/app/_components/ChoiceWithOther";
import { SPORT_OPTIONS } from "@/lib/event";

/** Role picker for staff forms. Defaults to cheer; a required sport picker only appears for compete (cheer has no sport). */
export default function RoleSportFields({ defaultRole = "cheer", defaultSport = "", className = "grid grid-cols-2 gap-2" }: { defaultRole?: string; defaultSport?: string; className?: string }) {
  const [role, setRole] = useState(defaultRole === "compete" ? "compete" : "cheer");
  return (
    <div className={role === "compete" ? className : "grid gap-2"}>
      <select name="role" value={role} onChange={(event) => setRole(event.target.value)} className="h-fit rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900">
        <option value="cheer">📣 เชียร์</option>
        <option value="compete">🏃 แข่งกีฬา</option>
      </select>
      {role === "compete" && <ChoiceWithOther name="sport" options={SPORT_OPTIONS} defaultValue={defaultSport} placeholder="เลือกชนิดกีฬา" otherPlaceholder="พิมพ์ชนิดกีฬา" />}
    </div>
  );
}
