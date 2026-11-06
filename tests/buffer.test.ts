import assert from "node:assert/strict";
import test from "node:test";
import { BufferError, graphql } from "../src/lib/buffer";

test("HTTP 200 with GraphQL errors is never publishing success", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      errors: [{ message: "internal detail must remain private" }],
    })) as unknown as typeof fetch;
  try {
    await assert.rejects(
      graphql("test", "mutation {}", {}, true),
      (cause) =>
        cause instanceof BufferError &&
        cause.uncertain &&
        !cause.message.includes("internal detail"),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("ambiguous mutation transport errors are not safe to retry", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network failed");
  }) as unknown as typeof fetch;
  try {
    await assert.rejects(
      graphql("test", "mutation {}", {}, true),
      (cause) => cause instanceof BufferError && cause.uncertain,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("known rate limits remain explicit and contain no provider response bodies", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("private provider body", {
      status: 429,
      headers: { "Retry-After": "20" },
    })) as unknown as typeof fetch;
  try {
    await assert.rejects(
      graphql("test", "query {}"),
      (cause) =>
        cause instanceof BufferError &&
        cause.status === 429 &&
        !cause.uncertain &&
        cause.message.includes("20 seconds"),
    );
  } finally {
    globalThis.fetch = original;
  }
});
