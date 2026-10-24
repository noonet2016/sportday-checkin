# Project: sportday-checkin

#project/sportday-checkin · ต้นแบบ: [[project-lineup-nextjs-migration|lineup-nextjs]]

## Goal
LINE LIFF check-in app for the school sports week (กีฬาสี): **purple-house students** confirm they are
**on campus** and **competing or cheering**, twice a day, **Mon 26 – Fri 30 Oct 2026**.

## Success criteria
- [ ] Student opens LIFF link → identified by LINE userId → bound to a purple-house student record (one-time bind by student ID if new).
- [ ] Check-in allowed only inside the slot windows: **morning 08:00–10:00, afternoon 13:00–14:00** (Asia/Bangkok wall-clock), 5 days = 10 slots.
- [ ] Student picks role: **compete** or **cheer**. One record per student per slot (unique).
- [ ] GPS must be inside the school geofence; multi-sample GPS + silent spoof flag, reused from lineup.
- [ ] Staff dashboard: per-slot checked / not checked / flagged, compete vs cheer counts; staff can record on a student's behalf with a reason (audit-logged).
- [ ] Report per student (x/10 slots) + per day, CSV export.
- [ ] Deployed on Plesk (new subdomain) and pilot-tested on campus **by Sun 25 Oct**.

## Milestones
- [x] M1 (Fri 23): Scaffold — Next.js/Prisma stack copied from lineup-nextjs, new schema, shared libs ported, builds clean, no DB yet.
- [x] M2 (Sat 24): Student flow — LIFF login, bind, slot check-in with GPS + spoof flag, own history.
- [x] M3 (done Sat 24 07:35 — commits dfaa34e, 74b627c; DB smoke 15/15 PASS on local sportday_dev): Staff — login, live dashboard, manual record, report/CSV, admin settings (days/slots/geofence), roster import.
- [ ] M4 (Sun 25 PM): Deploy to Plesk + on-campus pilot with 3–5 students.
- [ ] M5 (Mon 26–Fri 30): Live; on-call fixes.

## Key files
- `PROJECT_PLAN.md` — this plan · `WORKLOG.md` — project log
- `prisma/schema.prisma` — data model
- reference (read-only): `../lineup-nextjs/src/lib/{geo,checkin,time,line,session,prisma}.ts`, `../lineup-nextjs/src/app/checkin/CheckinClient.tsx`, `../lineup-nextjs/src/app/_components/MapPicker*.tsx`

## Dependencies / blockers
- **Open questions (Trainer gathering answers, 2026-10-23):**
  - ~~Q2 roster~~ ✅ answered 2026-10-23: 14 Excel files (one per room) in `data/roster/` → combined `data/roster/purple-students.csv` = **503 students**, 14 rooms. Excel is the source of truth (Trainer). Room 1/15 & 3/15 = EP (English Program), 2/14 & 5/13 = SMTE (special science). Excel header row mislabels col2/col3 (`prefix`,`idstudent` swapped — data is id then prefix).
  - Q4 if "compete", record the sport name?
  - ~~Q5~~ ✅ 2026-10-24: each teacher sees ONLY assigned rooms (StaffRoom m2m); admin sees all + manages staff/rooms.
  - ~~Q6~~ ✅ 2026-10-24: pass/fail — attend ≥80% of slots (8/10) → ผ่าน; shown on report + CSV.
- LINE: reuse the `tnw-lineup` provider so existing lineup userIds match (needs a new LIFF app/endpoint on that channel — Trainer action in LINE Developers Console).
- DB: local dev `sportday_dev` (Homebrew MariaDB) ✅ populated 2026-10-24. Prod DB + subdomain on Plesk — not created yet.
- Real campus geofence (center + radius) — not set yet (smoke used fixture coords).

## Decisions
- 2026-10-24: Teio hit Codex limit (until 22 Nov) → Tomi took M3; Trainer: if Tomi hits limit, Khumsap continues without re-asking.
- 2026-10-24: clear-flag and delete are admin-only; staff on-behalf after a student self-checked = rejected (Tomi).
- 2026-10-23: Event dates confirmed **26–30 Oct 2569** (Trainer first said พ.ย. — corrected).
- 2026-10-23: Slot windows **08:00–10:00** and **13:00–14:00** (Trainer).
- 2026-10-23: New standalone project (not a feature inside lineup-nextjs); lineup-nextjs is the pattern source, never edited.
- 2026-10-23: Defaults until Q2–Q6 answered: roster table with `house` column (seed purple only), optional nullable `sport` field, staff = username/password like lineup teachers.
- 2026-10-23: Student data → subscription teammates only (never Meetang/AiPASS). Builder = Tokai Teio.

## Notes
- 2026-10-23: `scripts/import-roster.ts` expects `house` col; combined CSV has `program` instead (house = purple for all). Add `program` (nullable: EP/SMTE) to Student in M2.
- Times are Bangkok wall-clock — reuse lineup's `time.ts` helpers; never `new Date()` + toLocaleString double-shift ([[lineup-nextjs-bangkok-wallclock-tz]]).
- Plesk/Passenger gotchas: [[reference-nextjs-plesk-deploy-proven]].
