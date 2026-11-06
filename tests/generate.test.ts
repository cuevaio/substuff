import assert from "node:assert/strict";
import test from "node:test";
import { sampleArticle } from "../src/lib/content";
import { generateWithFallback, safeDiagnostic } from "../src/lib/generate";

const valid = { notes: [sampleArticle.notes[0]] };

test("grounded output needs only one model call", async () => {
  const calls: string[] = [];
  const output = await generateWithFallback(
    sampleArticle.content,
    "primary",
    "fallback",
    async (model) => {
      calls.push(model);
      return valid;
    },
  );
  assert.deepEqual(calls, ["primary"]);
  assert.equal(output.notes.length, 1);
});

test("unsupported source triggers exactly one fallback", async () => {
  const calls: string[] = [];
  await generateWithFallback(
    sampleArticle.content,
    "primary",
    "fallback",
    async (model) => {
      calls.push(model);
      return model === "primary"
        ? {
            notes: [
              {
                ...sampleArticle.notes[0],
                source: "This claim is not present in the supplied article.",
              },
            ],
          }
        : valid;
    },
  );
  assert.deepEqual(calls, ["primary", "fallback"]);
});

test("provider failure can fall back, but duplicate models are not retried", async () => {
  let calls = 0;
  await assert.rejects(
    generateWithFallback(sampleArticle.content, "same", "same", async () => {
      calls++;
      throw new Error("provider body must stay private");
    }),
  );
  assert.equal(calls, 1);
});

test("diagnostics never include messages or provider data", () => {
  const result = safeDiagnostic({
    name: "ProviderError",
    statusCode: 503,
    message: "private article or credential",
    responseBody: "private",
  });
  assert.deepEqual(result, {
    name: "ProviderError",
    status: 503,
    editorialGuard: false,
  });
});
