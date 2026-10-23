// Central timezone handling. The app must behave the same regardless of the host machine's own
// system timezone (dev Macs here happen to be Asia/Bangkok already, which silently hid this class of
// bug — Plesk production may run UTC or anything else).
//
// Two distinct kinds of Date flow through this app:
//  1. "Wall-clock" Date/DateTime/Time columns (session_date, check_time, holiday_date, start_time, ...).
//     The mariadb driver round-trips these as literal digits via the Date object's UTC getters (no
//     timezone conversion on read or write — confirmed empirically). Legacy PHP wrote them with a
//     +07:00 DB session timezone, i.e. the digits already ARE Bangkok wall-clock time. So: read them
//     with `timeZone: "UTC"` formatters, and construct new ones with `Date.UTC(...)` using Bangkok
//     wall-clock components (never `new Date()` directly for something destined for one of these columns).
//  2. Real instants (e.g. "right now" for a page header) — these need genuine Bangkok conversion,
//     `timeZone: "Asia/Bangkok"`.
export const BANGKOK_TZ = "Asia/Bangkok";

/** The real current instant's Bangkok-local y/m/d/h/m/s, and two Date encodings of it. */
export function nowInBangkok(): { dateOnly: Date; hms: string; wallClock: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const y = Number(get("year"));
  const mo = Number(get("month")) - 1;
  const d = Number(get("day"));
  const h = Number(get("hour"));
  const mi = Number(get("minute"));
  const s = Number(get("second"));
  return {
    dateOnly: new Date(Date.UTC(y, mo, d)),
    hms: `${get("hour")}:${get("minute")}:${get("second")}`,
    wallClock: new Date(Date.UTC(y, mo, d, h, mi, s)),
  };
}

/** Today's Bangkok date as a UTC-midnight Date — matches how @db.Date columns are stored/compared. */
export function todayInBangkok(): Date {
  return nowInBangkok().dateOnly;
}

/** Parse a "YYYY-MM-DD" input (e.g. an HTML date input or ?query param) into a UTC-midnight Date, or null if malformed. */
export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a wall-clock-carried Date as "YYYY-MM-DD" for HTML date inputs / CSV columns. */
export function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Format a wall-clock-carried Date/DateTime column value (see module doc) as a Thai long date. */
export function formatWallClockDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Format a wall-clock-carried Time/DateTime column value (see module doc) as "HH:mm น." or "HH:mm:ss น.". */
export function formatWallClockTime(date: Date | null, withSeconds = false): string {
  if (!date) return "-";
  return (
    new Intl.DateTimeFormat("th-TH", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds ? "2-digit" : undefined,
    }).format(date) + " น."
  );
}

/**
 * Format a wall-clock-carried DateTime column as a Thai long date, e.g.
 * "วันอาทิตย์ ที่ 5 เดือนกรกฎาคม พ.ศ.2569" — timeZone UTC so no +7 shift.
 * Pair with formatWallClockTime(date, true) for the "เวลา HH:mm:ss น." line.
 */
export function formatWallClockThaiDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ที่ ${get("day")} เดือน${get("month")} พ.ศ.${get("year")}`;
}

/** Format a real instant (e.g. "now") as a Thai long date, genuinely converted to Bangkok time. */
export function formatInstantDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: BANGKOK_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
