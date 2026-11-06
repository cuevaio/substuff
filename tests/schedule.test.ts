import assert from "node:assert/strict";
import test from "node:test";
import { validSchedule, validScheduleBatch } from "../src/lib/schedule";

test("browser and server share inclusive publishing-time boundaries", () => {
  const now = Date.UTC(2026, 10, 6);
  for (const offset of [-60000, 0, 5 * 60000 - 1, 90 * 86400000 + 1]) {
    const date = new Date(now + offset);
    assert.equal(validSchedule(date, now), false);
    assert.equal(validSchedule(date.toISOString(), now), false);
  }
  for (const offset of [5 * 60000, 86400000, 90 * 86400000]) {
    const date = new Date(now + offset);
    assert.equal(validSchedule(date, now), true);
    assert.equal(validSchedule(date.toISOString(), now), true);
  }
});

test("review rejects empty, invalid and partly out-of-window schedules", () => {
  const now = Date.UTC(2026, 10, 6);
  const day = (days: number) => new Date(now + days * 86400000);
  assert.equal(validScheduleBatch([], now), false);
  assert.equal(validScheduleBatch([new Date("invalid")], now), false);
  assert.equal(validScheduleBatch([day(89), day(90), day(91)], now), false);
  assert.equal(validScheduleBatch([day(1), day(2), day(3)], now), true);
});
