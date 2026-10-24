import test from "node:test";
import assert from "node:assert/strict";
import { roomAllowed } from "../src/lib/staff-access";

test("room scope matches exact class and room pairs", () => {
  const rooms = [{ classLevel: "2", room: "7" }, { classLevel: "2", room: "14" }];
  assert.equal(roomAllowed(rooms, "2", "7"), true);
  assert.equal(roomAllowed(rooms, "2", "14"), true);
  assert.equal(roomAllowed(rooms, "2", "1"), false);
  assert.equal(roomAllowed(rooms, "3", "7"), false);
  assert.equal(roomAllowed([], "2", "7"), false);
});
