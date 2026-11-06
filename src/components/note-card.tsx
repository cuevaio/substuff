"use client";

import Image from "next/image";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import {
  ArrowUpRight,
  ArticleLink,
  Check,
  Copy,
  Edit,
  FileText,
  More,
  Posted,
  RotateCcw,
} from "@/components/icons";
import { NoteEditor } from "@/components/note-editor";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Article, Note } from "@/lib/content";
import type { DeliveryReceipt } from "@/lib/delivery";
import type { noteProfile } from "@/lib/note-profile";
import { noteState } from "@/lib/note-state";

function Avatar({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="note-avatar" aria-hidden="true">
      {url && !failed ? (
        <Image
          src={url}
          unoptimized
          alt=""
          width={36}
          height={36}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{Array.from(name)[0]?.toUpperCase() || "N"}</span>
      )}
    </span>
  );
}

export function NoteCard({
  article,
  note,
  receipts,
  profile,
  ready,
  onUpdate,
  onCopy,
  onSource,
  onEdit,
  onRestore,
}: {
  article: Article;
  note: Note;
  receipts: DeliveryReceipt[];
  profile: ReturnType<typeof noteProfile>;
  ready: boolean;
  onUpdate: (changes: Partial<Note>) => void;
  onCopy: (text: string) => void;
  onSource: () => void;
  onEdit: () => void;
  onRestore: () => void;
}) {
  const state = noteState(note, receipts);
  const posted = receipts.find((receipt) => receipt.status === "sent");
  const text = posted?.text ?? note.text;
  const readOnly = state !== "to-approve" || !ready;
  const cardUrl =
    state === "posted"
      ? posted?.attachmentUrl
      : note.includeArticle !== false
        ? article.sourceUrl
        : null;
  const name = profile?.name || "Your Note";
  const remote = receipts.find((receipt) => receipt.bufferPostId);
  return (
    <article className="compact-note feed-note" data-note-state={state}>
      <Avatar
        key={profile?.avatar || "fallback"}
        url={profile?.avatar}
        name={name}
      />
      <header className="note-byline">
        {profile?.url ? (
          <a
            className="note-author"
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {name}
          </a>
        ) : (
          <span className="note-author">{name}</span>
        )}
        {state !== "to-approve" && (
          <span className={`note-state state-${state}`}>
            {state === "posted" ? <Posted size={12} /> : <Check size={12} />}
            {state === "posted" ? "Posted" : "Approved"}
          </span>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="icon-button note-more"
              aria-label="More Note options"
            >
              <More size={19} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="note-menu"
              sideOffset={5}
              align="end"
            >
              <DropdownMenu.Item className="note-menu-item" onSelect={onSource}>
                <FileText size={15} />
                Show source
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="note-menu-item"
                onSelect={() => onCopy(text)}
              >
                <Copy size={15} />
                Copy text
              </DropdownMenu.Item>
              {state === "approved" && (
                <DropdownMenu.Item
                  className="note-menu-item"
                  disabled={!ready}
                  onSelect={onEdit}
                >
                  <Edit size={15} />
                  Edit Note
                </DropdownMenu.Item>
              )}
              {state === "to-approve" && (
                <DropdownMenu.Item
                  className="note-menu-item"
                  disabled={note.text === note.original || !ready}
                  onSelect={onRestore}
                >
                  <RotateCcw size={15} />
                  Restore original
                </DropdownMenu.Item>
              )}
              {article.sourceUrl && state !== "posted" && (
                <DropdownMenu.CheckboxItem
                  className="note-menu-item"
                  disabled={readOnly}
                  checked={note.includeArticle !== false}
                  onCheckedChange={(checked) =>
                    onUpdate({
                      includeArticle: checked,
                      approved: false,
                      richText: undefined,
                    })
                  }
                >
                  <ArticleLink size={15} />
                  Include article card
                  <DropdownMenu.ItemIndicator>
                    <Check size={13} />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.CheckboxItem>
              )}
              {remote && (
                <DropdownMenu.Item asChild className="note-menu-item">
                  <a
                    href={`https://publish.buffer.com/channels/${encodeURIComponent(remote.channelId)}/schedule`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowUpRight size={15} />
                    Open in Buffer
                  </a>
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>
      <div className="note-content">
        {readOnly ? (
          <p className="note-readonly">{text}</p>
        ) : (
          <NoteEditor
            note={note}
            onChange={(changes) => onUpdate({ ...changes, approved: false })}
          />
        )}
        {cardUrl && (
          <a
            className="note-article-card"
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="substack-mark"
              src="/brand/substack.png"
              width={38}
              height={38}
              alt="Substack"
            />
            <span>
              {article.title}
              <small>{new URL(cardUrl).hostname}</small>
            </span>
            <ArrowUpRight size={14} />
          </a>
        )}
        {state !== "posted" && (
          <footer className="note-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={`icon-button note-primary-action ${state === "approved" ? "edit-note-button" : "approve-button"}`}
                  aria-label={
                    state === "approved" ? "Edit Note" : "Approve Note"
                  }
                  disabled={
                    !ready ||
                    (state === "to-approve" &&
                      (!note.text.trim() || note.text.length > 10000))
                  }
                  onClick={
                    state === "approved"
                      ? onEdit
                      : () => onUpdate({ approved: true, richText: undefined })
                  }
                >
                  {state === "approved" ? (
                    <Edit size={18} />
                  ) : (
                    <Check size={19} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={5}>
                {state === "approved" ? "Edit Note" : "Approve Note"}
              </TooltipContent>
            </Tooltip>
          </footer>
        )}
      </div>
    </article>
  );
}
