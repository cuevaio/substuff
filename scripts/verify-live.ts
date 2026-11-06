// Public HTTP acceptance for the mandatory Buffer sign-in boundary.
// Authenticated import/delivery acceptance lives in verify-automation.ts and QA.md.
import assert from "node:assert/strict";
import { sampleArticle } from "../src/lib/content";

const origin = process.env.QA_ORIGIN || "http://127.0.0.1:3101";
const headers = { Origin: origin, "Content-Type": "application/json" };
const document = {
  version: 1,
  activeId: sampleArticle.id,
  articles: [sampleArticle],
};
const requests = [
  { path: "/api/workspace", method: "PUT", body: { revision: 0, document } },
  {
    path: "/api/feed",
    method: "POST",
    body: {
      url: "https://cuevaio.substack.com",
      automationVersion: 0,
      publishNow: false,
    },
  },
  {
    path: "/api/posts/import",
    method: "POST",
    body: {
      url: "https://cuevaio.substack.com/p/actually-building-with-ai",
      automationVersion: 0,
      publishNow: false,
    },
  },
  {
    path: "/api/onboarding",
    method: "POST",
    body: { url: "https://cuevaio.substack.com" },
  },
  {
    path: "/api/import",
    method: "POST",
    body: { url: "https://cuevaio.substack.com/p/actually-building-with-ai" },
  },
  {
    path: "/api/generate",
    method: "POST",
    body: { title: sampleArticle.title, content: sampleArticle.content },
  },
  {
    path: "/api/automation",
    method: "PUT",
    body: { enabled: false, version: 0 },
  },
];
assert.equal(
  (await (await fetch(`${origin}/api/workspace`)).json()).document,
  null,
);
for (const { path, method, body } of requests) {
  const denied: Response = await fetch(`${origin}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  assert.equal(
    denied.status,
    401,
    `${path} requires an authenticated Buffer account`,
  );
  const foreign = await fetch(`${origin}${path}`, {
    method,
    headers: { ...headers, Origin: "https://example.org" },
    body: JSON.stringify(body),
  });
  assert.equal(foreign.status, 403, `${path} rejects foreign origins`);
}
// Starting OAuth creates a temporary guest session, not an authenticated account.
const connect = await fetch(`${origin}/api/buffer/connect`, {
  method: "POST",
  headers,
});
assert.equal(connect.status, 200);
const cookie = connect.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
const auth = new URL((await connect.json()).url);
assert.equal(auth.origin, "https://auth.buffer.com");
assert.equal(
  auth.searchParams.get("redirect_uri"),
  "https://substuff.vercel.app/api/buffer/callback",
);
const guestRead = await fetch(`${origin}/api/workspace`, {
  headers: { Cookie: cookie },
});
assert.equal((await guestRead.json()).document, null);
for (const { path, method, body } of requests) {
  const denied: Response = await fetch(`${origin}${path}`, {
    method,
    headers: { ...headers, Cookie: cookie },
    body: JSON.stringify(body),
  });
  assert.equal(
    denied.status,
    401,
    `${path} must reject a pre-OAuth guest cookie`,
  );
}
assert.equal(
  (
    await fetch(`${origin}/api/session/sign-out`, {
      method: "POST",
      headers: { ...headers, Cookie: cookie },
    })
  ).status,
  200,
);
console.log(
  "PASS: required Buffer sign-in, no guest workspace/demo/generation bypass, OAuth guest isolation, valid OAuth destination, origin protection and sign-out. No model or publishing request was made.",
);
