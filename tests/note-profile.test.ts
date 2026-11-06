import assert from "node:assert/strict";
import test from "node:test";
import type { BufferChannel } from "../src/lib/buffer";
import { httpsUrl, noteProfile } from "../src/lib/note-profile";

const channel = (id: string): BufferChannel => ({
  id,
  name: "writer",
  displayName: "Writer",
  avatar: "https://substackcdn.com/avatar.png",
  externalLink: "https://substack.com/@writer",
  service: "substack",
  organizationId: "org",
  timezone: "UTC",
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
  allowedActions: [],
});

test("connected Substack profile provides the real author and avatar", () => {
  assert.deepEqual(noteProfile([channel("one")]), {
    name: "Writer",
    avatar: "https://substackcdn.com/avatar.png",
    url: "https://substack.com/@writer",
  });
  assert.equal(
    noteProfile([{ ...channel("one"), displayName: null }])?.name,
    "writer",
  );
});
test("multi-channel Notes never pick an arbitrary author", () => {
  const channels = [
    channel("one"),
    { ...channel("two"), displayName: "Other writer" },
  ];
  assert.equal(noteProfile(channels), null);
  assert.equal(noteProfile(channels, "missing"), null);
  assert.equal(noteProfile(channels, "two")?.name, "Other writer");
});
test("profile links and image URLs reject unsafe schemes and credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,x",
    "http://example.com/a",
    "https://user:pass@example.com/a",
    "bad",
  ])
    assert.equal(httpsUrl(url), undefined);
  assert.equal(
    noteProfile([
      {
        ...channel("one"),
        externalLink: "https://substack.com.evil.test/@writer",
        avatar: "javascript:alert(1)",
      },
    ])?.url,
    undefined,
  );
  assert.equal(
    noteProfile([{ ...channel("one"), avatar: undefined }])?.avatar,
    undefined,
  );
});
