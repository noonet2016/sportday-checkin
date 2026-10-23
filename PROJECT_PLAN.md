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
- [ ] M1 (Fri 23): Scaffold — Next.js/Prisma stack copied from lineup-nextjs, new schema, shared libs ported, builds clean, no DB yet.
- [ ] M2 (Sat 24): Student flow — LIFF login, bind, slot check-in with GPS + spoof flag, own history.
- [ ] M3 (Sun 25 AM): Staff — login, live dashboard, manual record, report/CSV, admin settings (days/slots/geofence), roster import.
- [ ] M4 (Sun 25 PM): Deploy to Plesk + on-campus pilot with 3–5 students.
- [ ] M5 (Mon 26–Fri 30): Live; on-call fixes.

## Key files
- `PROJECT_PLAN.md` — this plan · `WORKLOG.md` — project log
- `prisma/schema.prisma` — data model
- reference (read-only): `../lineup-nextjs/src/lib/{geo,checkin,time,line,session,prisma}.ts`, `../lineup-nextjs/src/app/checkin/CheckinClient.tsx`, `../lineup-nextjs/src/app/_components/MapPicker*.tsx`

## Dependencies / blockers
- **Open questions (Trainer gathering answers, 2026-10-23):**
  - Q2 purple roster source / size / already in lineup DB? (document from school)
  - Q4 if "compete", record the sport name?
  - Q5 who can access the dashboard (how many purple-house staff)?
  - Q6 what the result is used for (activity hours? pass/fail?) — shapes the report.
- LINE: reuse the `tnw-lineup` provider so existing lineup userIds match (needs a new LIFF app/endpoint on that channel — Trainer action in LINE Developers Console).
- DB: new database on Plesk + local dev DB — not created yet.

## Decisions
- 2026-10-23: Event dates confirmed **26–30 Oct 2569** (Trainer first said พ.ย. — corrected).
- 2026-10-23: Slot windows **08:00–10:00** and **13:00–14:00** (Trainer).
- 2026-10-23: New standalone project (not a feature inside lineup-nextjs); lineup-nextjs is the pattern source, never edited.
- 2026-10-23: Defaults until Q2–Q6 answered: roster table with `house` column (seed purple only), optional nullable `sport` field, staff = username/password like lineup teachers.
- 2026-10-23: Student data → subscription teammates only (never Meetang/AiPASS). Builder = Tokai Teio.

## Notes
- Times are Bangkok wall-clock — reuse lineup's `time.ts` helpers; never `new Date()` + toLocaleString double-shift ([[lineup-nextjs-bangkok-wallclock-tz]]).
- Plesk/Passenger gotchas: [[reference-nextjs-plesk-deploy-proven]].
