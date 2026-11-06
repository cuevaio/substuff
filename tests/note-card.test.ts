import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NoteCard } from "../src/components/note-card";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { sampleArticle } from "../src/lib/content";
import type { DeliveryReceipt } from "../src/lib/delivery";

function card(approved = false, receipts: DeliveryReceipt[] = []) {
  const article = {
    ...sampleArticle,
    sourceUrl: "https://writer.substack.com/p/article",
  };
  return load(
    renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(NoteCard, {
          article,
          note: { ...article.notes[0], approved },
          receipts,
          profile: null,
          ready: true,
          onUpdate() {},
          onCopy() {},
          onSource() {},
          onEdit() {},
          onRestore() {},
        }),
      ),
    ),
  );
}

test("Approve and Edit sit beside the menu in the byline, never below the Note", () => {
  for (const approved of [false, true]) {
    const $ = card(approved);
    const action = $(".note-byline .note-header-actions .note-primary-action");
    assert.equal(
      action.attr("aria-label"),
      approved ? "Edit Note" : "Approve Note",
    );
    assert.equal(action.next(".note-more").length, 1);
    assert.equal(
      $(".note-content button, .note-actions, .feed-note footer").length,
      0,
    );
    assert.equal($(".note-article-card svg").length, 0);
    assert.equal($(".note-article-card").attr("target"), "_blank");
  }
});

test("Posted Notes retain only the menu, without an approval or edit action", () => {
  const $ = card(true, [
    {
      id: "sent",
      articleId: sampleArticle.id,
      noteId: sampleArticle.notes[0].id,
      status: "sent",
      mode: "now",
      channelId: "channel",
      bufferPostId: "remote",
      dueAt: null,
      hash: "hash",
      error: null,
      text: "Delivered text",
    },
  ]);
  assert.equal(
    $(".note-header-actions .note-primary-action, textarea").length,
    0,
  );
  assert.equal($(".note-header-actions .note-more").length, 1);
  assert.equal($(".note-readonly").text(), "Delivered text");
});
