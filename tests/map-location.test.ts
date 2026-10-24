import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapLocation } from "../src/lib/map-location";

test("parses supported pasted coordinate formats", () => {
  for (const [input, expected] of [
    ["13.7563, 100.5018", { lat: 13.7563, lng: 100.5018 }],
    ["13.7563,100.5018", { lat: 13.7563, lng: 100.5018 }],
    ["https://google.com/maps/@13.7563,100.5018,17z", { lat: 13.7563, lng: 100.5018 }],
    ["https://google.com/maps/place/School/@13.7563,100.5018,17z", { lat: 13.7563, lng: 100.5018 }],
    ["https://google.com/maps/@14,101,17z/data=!3d13.7563!4d100.5018", { lat: 13.7563, lng: 100.5018 }],
    ["https://google.com/maps?q=13.7563,100.5018", { lat: 13.7563, lng: 100.5018 }],
    ["https://google.com/maps?ll=13.7563,100.5018", { lat: 13.7563, lng: 100.5018 }],
  ] as const) assert.deepEqual(parseMapLocation(input), expected);
});

test("rejects garbage and out-of-range coordinate values", () => {
  assert.equal(parseMapLocation("nothing useful"), null);
  assert.equal(parseMapLocation("91, 100"), null);
  assert.equal(parseMapLocation("0, 181"), null);
});
