import assert from "node:assert/strict";
import test from "node:test";
import { mayAutoPublish } from "../src/lib/automation-policy";

const enabled = {
  enabled: true,
  channelId: "channel",
  version: 4,
  consentAt: new Date(),
  policyVersion: 1,
};
test("public automation needs stored consent and the exact consent version", () => {
  assert.equal(mayAutoPublish(enabled, 4), true);
  for (const policy of [
    undefined,
    { ...enabled, enabled: false },
    { ...enabled, consentAt: null },
    { ...enabled, channelId: null },
  ])
    assert.equal(mayAutoPublish(policy, 4), false);
  assert.equal(mayAutoPublish(enabled, null), false);
  assert.equal(mayAutoPublish(enabled, 3), false);
  assert.equal(mayAutoPublish(enabled, 5), false);
  assert.equal(mayAutoPublish({ ...enabled, policyVersion: 0 }, 4), false);
});
