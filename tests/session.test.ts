import assert from "node:assert/strict";
import test from "node:test";
import { digest, sameOrigin } from "../src/lib/session";

test("origin comparison uses browser host even when Next normalizes the internal URL", () => {
  const request = new Request("http://localhost:3101/api/workspace", {
    headers: { host: "127.0.0.1:3101", origin: "http://127.0.0.1:3101" },
  });
  assert.ok(sameOrigin(request));
});

test("missing and foreign origins cannot mutate workspaces", () => {
  for (const origin of ["https://example.org", "null", "not a url"]) {
    assert.equal(
      sameOrigin(
        new Request("https://substuff.vercel.app/api/workspace", {
          headers: { host: "substuff.vercel.app", origin },
        }),
      ),
      false,
    );
  }
  assert.equal(
    sameOrigin(
      new Request("https://substuff.vercel.app/api/workspace", {
        headers: { host: "substuff.vercel.app" },
      }),
    ),
    false,
  );
});

test("guest credentials are persisted as deterministic hashes, not bearer tokens", () => {
  const token = "test-only-guest-credential";
  assert.equal(digest(token).length, 64);
  assert.notEqual(digest(token), token);
  assert.equal(digest(token), digest(token));
});
