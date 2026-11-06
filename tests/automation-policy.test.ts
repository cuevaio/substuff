import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_POLICY_VERSION,
  mayAutoApprove,
} from "../src/lib/automation-policy";

const enabled = {
  enabled: true,
  version: 4,
  consentAt: new Date(),
  policyVersion: AUTO_POLICY_VERSION,
};
test("auto-approval needs the current explicit choice and exact job version, not a publishing channel", () => {
  assert.equal(mayAutoApprove(enabled, 4), true);
  for (const policy of [
    undefined,
    { ...enabled, enabled: false },
    { ...enabled, consentAt: null },
  ])
    assert.equal(mayAutoApprove(policy, 4), false);
  assert.equal(mayAutoApprove(enabled, null), false);
  assert.equal(mayAutoApprove(enabled, 3), false);
  assert.equal(mayAutoApprove(enabled, 5), false);
  assert.equal(mayAutoApprove({ ...enabled, policyVersion: 0 }, 4), false);
  assert.equal(
    mayAutoApprove({ ...enabled, policyVersion: 1 }, 4),
    false,
    "legacy publication consent must not enable auto-approval",
  );
});
