import { cancelRecord, deleteRecord, editRecord } from "@/app/staff/actions";
import ConfirmSubmit from "@/app/_components/ConfirmSubmit";
import RoleSportFields from "./RoleSportFields";
import ChoiceWithOther from "@/app/_components/ChoiceWithOther";
import { DELETE_REASON_OPTIONS, ONBEHALF_REASON_OPTIONS } from "@/lib/event";

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
            <RoleSportFields defaultRole={record.role} defaultSport={record.sport ?? ""} />
            {isStaffRecord
              ? <ChoiceWithOther name="reason" options={ONBEHALF_REASON_OPTIONS} defaultValue={record.note ?? ""} placeholder="เลือกเหตุผลที่บันทึกแทน" otherPlaceholder="พิมพ์เหตุผล (อย่างน้อย 3 ตัวอักษร)" maxLength={500} />
              : <input name="reason" required minLength={3} maxLength={500} placeholder="เหตุผลที่แก้ไข" className="rounded-lg border border-slate-300 p-2 text-sm" />}
            <button className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white hover:bg-violet-800">บันทึกการแก้ไข</button>
          </form>
          {isStaffRecord && (
            <form action={cancelRecord} className="mt-2">
              <input type="hidden" name="recordId" value={record.id} />
              <ConfirmSubmit label="ยกเลิกการบันทึกแทน" title="ยกเลิกการบันทึกแทน?" message="นักเรียนคนนี้จะกลับเป็น “ยังไม่เช็ค” ในรอบนี้" confirmLabel="ยืนยันยกเลิก" className="w-full rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700" />
            </form>
          )}
          {isAdmin && (
            <form action={deleteRecord} className="mt-3 grid gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
              <input type="hidden" name="recordId" value={record.id} />
              <p className="text-xs font-semibold text-red-800">🗑️ ลบรายการ (ผู้ดูแลระบบ) — นักเรียนจะกลับเป็น “ยังไม่เช็ค” และร้อยละ/สถานะผ่านอาจเปลี่ยน</p>
              <ChoiceWithOther name="reason" options={DELETE_REASON_OPTIONS} placeholder="เลือกเหตุผลที่ลบ" otherPlaceholder="พิมพ์เหตุผล (อย่างน้อย 3 ตัวอักษร)" maxLength={500} />
              <ConfirmSubmit label="ลบรายการ" title="ลบรายการเช็คชื่อนี้?" message="รายการจะถูกลบ นักเรียนกลับเป็น “ยังไม่เช็ค” ในรอบนี้ ระบบเก็บสำเนาและเหตุผลไว้ในบันทึกการตรวจสอบ" confirmLabel="ยืนยันลบ" className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700" />
            </form>
          )}
        </details>
      )}
    </div>
  );
}
