import test from "node:test";
import assert from "node:assert/strict";
import { attendancePassed, attendancePercent, EVENT_DATES, resolveSlotWindow } from "../src/lib/event";
import { haversineDistance } from "../src/lib/geo";
import { scoreSuspicion, type CheckinGpsSample } from "../src/lib/spoof";

const at = (iso: string) => new Date(iso);

test("resolves slot boundaries using Bangkok wall-clock dates", () => {
  assert.equal(resolveSlotWindow(at("2026-10-26T08:00:00Z"), EVENT_DATES).state, "open");
  assert.equal(resolveSlotWindow(at("2026-10-26T10:00:00Z"), EVENT_DATES).state, "closed");
  assert.equal(resolveSlotWindow(at("2026-10-26T13:00:00Z"), EVENT_DATES).state, "open");
  assert.equal(resolveSlotWindow(at("2026-10-26T14:00:00Z"), EVENT_DATES).state, "closed");
  assert.equal(resolveSlotWindow(at("2026-10-26T07:59:59Z"), EVENT_DATES).state, "before");
  assert.equal(resolveSlotWindow(at("2026-10-31T09:00:00Z"), EVENT_DATES).state, "not-event-day");
});

test("geofence distinguishes inside from outside", () => {
  const center = { lat: 13.7563, lng: 100.5018 };
  assert.ok(haversineDistance(center.lat, center.lng, center.lat, center.lng) <= 100);
  assert.ok(haversineDistance(center.lat, center.lng, 13.7663, 100.5018) > 100);
});

const sample = (lat: number, lng: number, accuracy = 20): CheckinGpsSample => ({
  lat, lng, accuracy, altitude: 10, altitudeAccuracy: 5, speed: 0, heading: 0, timestamp: Date.now(),
});

test("scores exact centroid and static GPS samples as suspicious", () => {
  const center = { name: "School", lat: 13.7563, lng: 100.5018 };
  const staticSamples = [sample(center.lat, center.lng), sample(center.lat, center.lng), sample(center.lat, center.lng)];
  assert.equal(scoreSuspicion(staticSamples, center.lat, center.lng, center).suspicious, true);
  const naturalSamples = [sample(13.7563, 100.5018), sample(13.75631, 100.50181), sample(13.75632, 100.50182)];
  assert.equal(scoreSuspicion(naturalSamples, 13.75633, 100.50183, center).suspicious, false);
});

test("DEV_NOW is honored only outside production", async () => {
  const { serverNow, nowInBangkok } = await import("../src/lib/time");
  const before = { node: process.env.NODE_ENV, override: process.env.DEV_NOW };
  try {
    process.env.DEV_NOW = "2026-10-26T08:30:00";
    Reflect.set(process.env, "NODE_ENV", "development");
    // DEV_NOW is Bangkok wall-clock: the instant is 01:30Z, and the Bangkok view must read 08:30 (no double +7h).
    assert.equal(serverNow().toISOString(), "2026-10-26T01:30:00.000Z");
    assert.equal(nowInBangkok().wallClock.toISOString(), "2026-10-26T08:30:00.000Z");
    Reflect.set(process.env, "NODE_ENV", "production");
    assert.notEqual(serverNow().toISOString(), "2026-10-26T01:30:00.000Z");
  } finally {
    if (before.node === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Reflect.set(process.env, "NODE_ENV", before.node);
    if (before.override === undefined) delete process.env.DEV_NOW; else process.env.DEV_NOW = before.override;
  }
});

test("default slot selects upcoming/current/last event slot", async () => {
  const { resolveDefaultSlot } = await import("../src/lib/event");
  const dates = ["2026-10-26", "2026-10-27"];
  assert.deepEqual(resolveDefaultSlot(at("2026-10-24T12:00:00Z"), dates), { date: "2026-10-26", period: "morning" });
  assert.deepEqual(resolveDefaultSlot(at("2026-10-26T08:30:00Z"), dates), { date: "2026-10-26", period: "morning" });
  assert.deepEqual(resolveDefaultSlot(at("2026-10-26T11:00:00Z"), dates), { date: "2026-10-26", period: "afternoon" });
  assert.deepEqual(resolveDefaultSlot(at("2026-10-27T15:00:00Z"), dates), { date: "2026-10-27", period: "afternoon" });
});

test("room sorting compares class and room numerically", async () => {
  const { compareRooms } = await import("../src/lib/event");
  const rooms = ["1/15", "1/4", "4/11", "4/5", "6/12", "6/6"];
  const sorted = rooms.map(value => { const [classLevel, room] = value.split("/"); return { value, classLevel, room }; }).sort(compareRooms).map(x => x.value);
  assert.deepEqual(sorted, ["1/4", "1/15", "4/5", "4/11", "6/6", "6/12"]);
});

test("attendancePassed uses the 80% rule over all slots", () => {
  assert.equal(attendancePassed(8, 10), true);
  assert.equal(attendancePassed(7, 10), false);
  assert.equal(attendancePassed(10, 10), true);
  assert.equal(attendancePassed(0, 0), false);
});

test("attendancePercent rounds to whole percent", () => {
  assert.equal(attendancePercent(8, 10), 80);
  assert.equal(attendancePercent(7, 10), 70);
  assert.equal(attendancePercent(2, 3), 67);
  assert.equal(attendancePercent(0, 0), 0);
});
