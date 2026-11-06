import assert from "node:assert/strict";
import test from "node:test";
import {
  hasSubstackChannel,
  hasWriting,
  onboardingSteps,
} from "../src/lib/onboarding";

test("historical demos cannot complete onboarding", () => {
  assert.equal(hasWriting([]), false);
  assert.equal(
    hasWriting([
      { mode: "sample", sourceUrl: "https://writer.substack.com/p/post" },
    ]),
    false,
  );
  assert.equal(hasWriting([{ mode: "ai" }]), false);
  assert.equal(
    hasWriting([
      { mode: "ai", sourceUrl: "https://writer.substack.com/p/post" },
    ]),
    true,
  );
});

test("onboarding progress describes actual content, analysis and generation phases", () => {
  assert.deepEqual(
    onboardingSteps.map((step) => step.id),
    ["content", "understanding", "style", "writing"],
  );
});

test("entry requires an active Substack channel, not merely Buffer authentication", () => {
  assert.equal(hasSubstackChannel(undefined), false);
  assert.equal(hasSubstackChannel([]), false);
  assert.equal(
    hasSubstackChannel([{ isDisconnected: true, isLocked: false }]),
    false,
  );
  assert.equal(
    hasSubstackChannel([{ isDisconnected: false, isLocked: true }]),
    false,
  );
  assert.equal(
    hasSubstackChannel([{ isDisconnected: false, isLocked: false }]),
    true,
  );
});
