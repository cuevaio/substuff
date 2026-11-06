import assert from "node:assert/strict";
import { generatedNotes, isGrounded, sampleArticle } from "../src/lib/content";

const origin = process.env.QA_ORIGIN || "http://127.0.0.1:3100";
const headers = { Origin: origin, "Content-Type": "application/json" };
const empty = { version: 1, activeId: "", articles: [] };
const document = {
  version: 1,
  activeId: sampleArticle.id,
  articles: [sampleArticle],
};

const status = await fetch(`${origin}/api/workspace`);
assert.equal(status.status, 200);
assert.equal((await status.json()).storage, "cloud");
const denied = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://example.org",
  },
  body: JSON.stringify({ revision: 0, document }),
});
assert.equal(denied.status, 403);
const importDenied = await fetch(`${origin}/api/import`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://example.org",
  },
  body: JSON.stringify({ url: "https://writer.substack.com/p/test" }),
});
assert.equal(importDenied.status, 403);
const unsafeImport = await fetch(`${origin}/api/import`, {
  method: "POST",
  headers,
  body: JSON.stringify({ url: "http://127.0.0.1/private" }),
});
assert.equal(unsafeImport.status, 400);
for (const path of [
  "/api/feed",
  "/api/posts/import",
  "/api/session/sign-out",
]) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      Origin: "https://example.org",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(response.status, 403);
}

const save = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ revision: 0, document }),
});
assert.equal(save.status, 200);
const revision = (await save.json()).revision;
const cookie = save.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "Server should issue a private workspace cookie");
const read = await fetch(`${origin}/api/workspace`, {
  headers: { Cookie: cookie },
});
assert.equal(
  (await read.json()).document.articles[0].title,
  sampleArticle.title,
);
const isolated = await fetch(`${origin}/api/workspace`);
assert.equal(
  (await isolated.json()).document,
  null,
  "A different browser must not see the workspace",
);
const conflict = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers: { ...headers, Cookie: cookie },
  body: JSON.stringify({ revision: 0, document: empty }),
});
assert.equal(conflict.status, 409);
const malformed = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers,
  body: '{"document":{}}',
});
assert.equal(malformed.status, 400);
const cleared = await fetch(`${origin}/api/workspace`, {
  method: "PUT",
  headers: { ...headers, Cookie: cookie },
  body: JSON.stringify({ revision, document: empty }),
});
assert.equal(cleared.status, 200);
const autoHeaders = { ...headers, Cookie: cookie };
const defaults = await fetch(`${origin}/api/automation`, {
  headers: { Cookie: cookie },
});
assert.equal((await defaults.json()).enabled, false);
const off = await fetch(`${origin}/api/automation`, {
  method: "PUT",
  headers: autoHeaders,
  body: JSON.stringify({ enabled: false, version: 0 }),
});
assert.equal(off.status, 200);
assert.equal((await off.json()).enabled, false);
const stalePolicy = await fetch(`${origin}/api/automation`, {
  method: "PUT",
  headers: autoHeaders,
  body: JSON.stringify({ enabled: false, version: 0 }),
});
assert.equal(stalePolicy.status, 409);
const unconfirmed = await fetch(`${origin}/api/automation`, {
  method: "PUT",
  headers: autoHeaders,
  body: JSON.stringify({
    enabled: true,
    version: 1,
    channelId: "qa-not-a-real-channel",
    notesPerPost: 1,
    confirmed: false,
    policyVersion: 1,
  }),
});
assert.equal(unconfirmed.status, 400);
if (process.argv.includes("--feed")) {
  const connected = await fetch(`${origin}/api/feed`, {
    method: "POST",
    headers: autoHeaders,
    body: JSON.stringify({
      url: "https://cuevaio.substack.com",
      automationVersion: 1,
      publishNow: false,
    }),
  });
  assert.equal(connected.status, 200);
  assert.ok((await connected.json()).posts.length > 0);
  const feed = await fetch(`${origin}/api/feed`, {
    headers: { Cookie: cookie },
  });
  assert.equal(
    (await feed.json()).publication.url,
    "https://cuevaio.substack.com",
  );
  assert.equal(
    (
      await fetch(`${origin}/api/feed`, {
        method: "DELETE",
        headers: autoHeaders,
      })
    ).status,
    200,
  );
  console.log(
    "PASS: real RSS feed listing, persistent connection and disconnection in an isolated QA workspace.",
  );
}
const signedOut = await fetch(`${origin}/api/session/sign-out`, {
  method: "POST",
  headers: autoHeaders,
});
assert.equal(signedOut.status, 200);
const revoked = await fetch(`${origin}/api/workspace`, {
  headers: { Cookie: cookie },
});
assert.equal(
  (await revoked.json()).document,
  null,
  "A revoked browser cookie must not reopen its workspace",
);
console.log(
  "PASS: persistence, cookie isolation/revocation, origin protection, unsafe URL rejection, revision conflict, opt-in consent/version guards, input rejection and workspace clearing.",
);

if (process.argv.includes("--ai")) {
  const result = await fetch(`${origin}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: sampleArticle.title,
      content: sampleArticle.content,
    }),
  });
  assert.equal(result.status, 200, "Live Gateway generation should succeed");
  const output = generatedNotes.parse(await result.json());
  assert.ok(
    output.notes.every((note) =>
      isGrounded(note.source, sampleArticle.content),
    ),
  );
  console.log(
    `PASS: Live AI SDK → Vercel AI Gateway structured generation; ${output.notes.length} source-linked Notes.`,
  );
}
