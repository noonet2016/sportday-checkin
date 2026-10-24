import { cancelRecord, editRecord } from "@/app/staff/actions";

type EditableRecord = { id: number; role: string; sport: string | null; note: string | null; source: string; staff: { displayName: string } | null };

/** On-behalf reason + edit/cancel controls for one check-in record (room page, cards and table). */
export default function RecordEditor({ record, isAdmin }: { record: EditableRecord; isAdmin: boolean }) {
  const isStaffRecord = record.source === "staff";
  const canEdit = isStaffRecord || isAdmin;
  return (
    <div className="space-y-2">
      {isStaffRecord && (
        <div className="rounded-lg bg-sky-50 p-2 text-xs text-sky-900 break-words">
          📝 <b>บันทึกแทนโดย {record.staff?.displayName ?? "เจ้าหน้าที่"}:</b> {record.note ?? "—"}
        </div>
      )}
      {canEdit && (
        // Keyed on the saved values: after a save the form remounts with the new defaults instead of resetting to stale ones.
        <details key={`${record.role}|${record.sport ?? ""}|${record.note ?? ""}`} className="rounded-lg border border-slate-200 p-2 text-sm">
          <summary className="cursor-pointer font-semibold text-violet-700">✏️ แก้ไขรายการนี้</summary>
          <form action={editRecord} className="mt-2 grid gap-2">
            <input type="hidden" name="recordId" value={record.id} />
            <div className="grid grid-cols-2 gap-2">
              <select name="role" defaultValue={record.role} className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900">
                <option value="compete">🏃 แข่งกีฬา</option>
                <option value="cheer">📣 เชียร์</option>
              </select>
              <input name="sport" defaultValue={record.sport ?? ""} placeholder="กีฬา (ถ้าแข่ง)" className="rounded-lg border border-slate-300 p-2 text-sm" />
            </div>
            <input name="reason" required minLength={3} maxLength={500} defaultValue={isStaffRecord ? record.note ?? "" : ""} placeholder={isStaffRecord ? "เหตุผลที่บันทึกแทน" : "เหตุผลที่แก้ไข"} className="rounded-lg border border-slate-300 p-2 text-sm" />
            <button className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-800">บันทึกการแก้ไข</button>
          </form>
          {isStaffRecord && (
            <form action={cancelRecord} className="mt-2">
              <input type="hidden" name="recordId" value={record.id} />
              <button className="w-full rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700">ยกเลิกการบันทึกแทน</button>
            </form>
          )}
        </details>
      )}
    </div>
  );
}
