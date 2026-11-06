import assert from "node:assert/strict";
import test from "node:test";
import { seal, unseal } from "../src/lib/crypto";

test("credentials are encrypted with authenticated, context-bound random IVs", () => {
  const original = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
  try {
    const one = seal("test-only-token", "workspace:access");
    const two = seal("test-only-token", "workspace:access");
    assert.notEqual(one, two);
    assert.equal(one.includes("test-only-token"), false);
    assert.equal(unseal(one, "workspace:access"), "test-only-token");
    assert.throws(() => unseal(one, "other-workspace:access"));
    assert.throws(() => unseal(`${one.slice(0, -3)}xyz`, "workspace:access"));
  } finally {
    if (original === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = original;
  }
});
