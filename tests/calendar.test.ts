import assert from "node:assert/strict";
import test from "node:test";
import { activeDelivery, dateKey, monthDays } from "../src/lib/calendar";

test("calendar groups UTC timestamps into the selected publishing timezone", () => {
  assert.equal(dateKey("2026-11-07T02:00:00Z", "America/Lima"), "2026-11-06");
  assert.equal(dateKey("2026-11-07T02:00:00Z", "UTC"), "2026-11-07");
  assert.equal(
    dateKey("2026-11-01T05:30:00Z", "America/New_York"),
    "2026-11-01",
  );
  assert.equal(
    dateKey("2026-11-01T06:30:00Z", "America/New_York"),
    "2026-11-01",
  );
});
test("month grid has complete weeks including leap days and year boundaries", () => {
  const days = monthDays(2028, 1);
  assert.equal(days.length, 35);
  assert.equal(days[0].getUTCDay(), 0);
  assert.ok(days.some((day) => day.toISOString().startsWith("2028-02-29")));
  assert.ok(monthDays(2026, 0)[0].getUTCFullYear() === 2025);
});
test("cancelled Notes never appear as upcoming publications", () => {
  assert.equal(activeDelivery("cancelled"), false);
  assert.equal(activeDelivery("scheduled"), true);
  assert.equal(activeDelivery("sent"), true);
});
