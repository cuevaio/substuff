"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DateTimePicker, localDateTime } from "@/components/date-time-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BufferChannel } from "@/lib/buffer";
import type { Article } from "@/lib/content";
import type { DeliveryReceipt } from "@/lib/delivery";
import { hasRichFormatting } from "@/lib/rich-text";
import { validScheduleBatch } from "@/lib/schedule";

type Connection = {
  configured: boolean;
  connected: boolean;
  accountName?: string;
  channels?: (BufferChannel & { organizationName: string })[];
  error?: string;
};
async function connectionStatus(): Promise<Connection> {
  const response = await fetch("/api/buffer");
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Couldn’t connect to Buffer.");
  return data;
}
export const connectionQuery = {
  queryKey: ["buffer-connection"],
  queryFn: connectionStatus,
};

export async function connectBuffer(beforeConnect: () => Promise<void>) {
  await beforeConnect();
  const response = await fetch("/api/buffer/connect", { method: "POST" });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Couldn’t connect to Buffer.");
  const url = new URL(data.url);
  if (url.origin !== "https://auth.buffer.com")
    throw new Error("Unexpected connection destination.");
  window.location.assign(url.toString());
}
async function textHash(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return localDateTime(date);
}
function statusLabel(status: string) {
  return (
    (
      {
        draft: "Draft",
        scheduled: "Scheduled",
        sending: "Publishing",
        sent: "Published",
        error: "Needs attention",
        creating: "Confirming…",
        unknown: "Check Buffer",
        cancelled: "Cancelled",
        needs_approval: "Awaiting approval",
      } as Record<string, string>
    )[status] || status
  );
}

export function BufferPanel({
  article,
  beforeSend,
  onExport,
}: {
  article: Article;
  beforeSend: () => Promise<void>;
  onExport: () => void;
}) {
  const client = useQueryClient();
  const connection = useQuery(connectionQuery);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [mode, setMode] = useState<"draft" | "schedule">("draft");
  const [start, setStart] = useState(tomorrow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const notes = article.notes.filter((note) => note.approved);
  const formatted = notes.some((note) => hasRichFormatting(note.richText));
  const channels = connection.data?.channels ?? [];
  const channelId =
    selectedChannel || (channels.length === 1 ? channels[0].id : "");
  const channel = channels.find((channel) => channel.id === channelId);
  const schedule = start
    ? notes.map((_, index) => {
        const date = new Date(start);
        date.setDate(date.getDate() + index);
        return date;
      })
    : [];
  const scheduleValid = validScheduleBatch(schedule);
  const historyKey = ["buffer-deliveries", article.id];
  const history = useQuery({
    queryKey: historyKey,
    queryFn: async () => {
      const response = await fetch(
        `/api/buffer/deliveries?articleId=${encodeURIComponent(article.id)}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Couldn’t load activity.");
      return data as { deliveries: DeliveryReceipt[]; warning?: string };
    },
  });
  const receipts = history.data?.deliveries ?? [];
  const matchingReceipts = notes.map((note) =>
    receipts.find(
      (receipt) =>
        receipt.noteId === note.id &&
        receipt.channelId === channelId &&
        receipt.hash === hashes[note.id],
    ),
  );
  const recorded = notes.length > 0 && matchingReceipts.every(Boolean);

  useEffect(() => {
    let active = true;
    void Promise.all(
      article.notes.map(
        async (note) => [note.id, await textHash(note.text)] as const,
      ),
    ).then((entries) => {
      if (active) setHashes(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [article.notes]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      await connectBuffer(beforeSend);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t connect.");
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/buffer/deliveries?articleId=${encodeURIComponent(article.id)}&sync=true`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Couldn’t refresh activity.");
      client.setQueryData(historyKey, data);
      if (data.warning) setError(data.warning);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t refresh activity.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (busy || sent || recorded) return;
    if (formatted) {
      setError(
        "Buffer only publishes plain text. Copy formatted Notes to Substack, or remove formatting before sending.",
      );
      return;
    }
    if (mode === "schedule" && !validScheduleBatch(schedule)) {
      setError("Choose a time between five minutes and 90 days from now.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await beforeSend();
      const selected = await Promise.all(
        notes.map(async (note, index) => ({
          id: note.id,
          hash: await textHash(note.text),
          ...(mode === "schedule"
            ? { dueAt: schedule[index].toISOString() }
            : {}),
        })),
      );
      const response = await fetch("/api/buffer/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          channelId,
          mode,
          confirmed: true,
          notes: selected,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Check Buffer before trying again.");
      await client.invalidateQueries({ queryKey: historyKey });
      if (
        data.deliveries.some((receipt: DeliveryReceipt) =>
          ["unknown", "error", "creating"].includes(receipt.status),
        )
      )
        setError(
          "Some Notes need attention. Check activity before trying again.",
        );
      else setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Check Buffer before trying again.",
      );
      await client.invalidateQueries({ queryKey: historyKey });
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/buffer/deliveries/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Check Buffer before trying again.");
      setCancelId(null);
      await client.invalidateQueries({ queryKey: historyKey });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t remove this Note.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="buffer-panel">
      {article.sourceUrl && (
        <p className="input-caption">
          The original article is attached as a preview card, not added to the
          Note text.
        </p>
      )}
      {formatted && (
        <p className="inline-error" role="alert">
          Buffer only publishes plain text. Your formatting is saved; copy these
          Notes to Substack, or remove formatting in the editor before sending.
        </p>
      )}
      {(error || connection.error || connection.data?.error) && (
        <p className="inline-error" role="alert">
          {error || connection.error?.message || connection.data?.error}
        </p>
      )}
      {connection.isPending ? (
        <p className="connection-loading">
          <LoaderCircle className="spinner" size={15} />
          Connecting…
        </p>
      ) : !connection.data?.connected ? (
        <>
          <p className="dialog-description">
            Connect Buffer to share your Notes.
          </p>
          <div className="dialog-actions">
            <button type="button" className="text-button" onClick={onExport}>
              Export text
            </button>
            <Button
              disabled={busy || !connection.data?.configured}
              onClick={connect}
            >
              Connect Buffer
            </Button>
          </div>
          {connection.isError && (
            <button
              type="button"
              className="text-button"
              onClick={() => void connection.refetch()}
            >
              Try again
            </button>
          )}
        </>
      ) : !channels.length ? (
        <p className="dialog-description">
          <a
            href="https://publish.buffer.com/settings/channels"
            target="_blank"
            rel="noreferrer"
          >
            Connect Substack in Buffer <ArrowUpRight size={13} />
          </a>
          <button
            type="button"
            className="text-button"
            onClick={() => void connection.refetch()}
          >
            Refresh
          </button>
        </p>
      ) : sent ? (
        <div className="share-success" role="status">
          <Check size={22} />
          <p>{mode === "draft" ? "Saved to Buffer" : "Notes scheduled"}</p>
          <a
            className="text-button"
            href="https://publish.buffer.com/"
            target="_blank"
            rel="noreferrer"
          >
            View in Buffer <ArrowUpRight size={13} />
          </a>
        </div>
      ) : recorded ? (
        <>
          <p className="dialog-description">
            {matchingReceipts.every((receipt) => receipt?.status === "sent")
              ? "Already published."
              : matchingReceipts.every(
                    (receipt) => receipt?.status === "cancelled",
                  )
                ? "These drafts were removed. Edit your Notes to share a new version."
                : matchingReceipts.some((receipt) =>
                      ["error", "unknown", "creating"].includes(
                        receipt?.status ?? "",
                      ),
                    )
                  ? "Check activity before sharing again."
                  : "Already in Buffer."}
          </p>
          <div className="dialog-actions">
            <button type="button" className="text-button" onClick={onExport}>
              Export text
            </button>
            <a
              className="text-button"
              href="https://publish.buffer.com/"
              target="_blank"
              rel="noreferrer"
            >
              View in Buffer <ArrowUpRight size={13} />
            </a>
          </div>
        </>
      ) : (
        <>
          {channels.length === 1 ? (
            <div className="share-destination">
              <span>{channel?.displayName || channel?.name}</span>
              <a
                href="https://publish.buffer.com/"
                target="_blank"
                rel="noreferrer"
                aria-label="Open Buffer"
              >
                <ArrowUpRight size={15} />
              </a>
            </div>
          ) : (
            <Select
              value={channelId}
              onValueChange={(value) => {
                setSelectedChannel(value);
                setSent(false);
              }}
              disabled={busy}
            >
              <SelectTrigger aria-label="Substack channel" className="w-full">
                <SelectValue placeholder="Choose Substack" />
              </SelectTrigger>
              <SelectContent position="popper" style={{ zIndex: 70 }}>
                {channels.map((channel) => (
                  <SelectItem
                    key={channel.id}
                    value={channel.id}
                    disabled={channel.isDisconnected || channel.isLocked}
                  >
                    {channel.displayName || channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(channel?.isDisconnected || channel?.isLocked) && (
            <p role="alert" className="inline-error">
              Reconnect this channel in Buffer.
            </p>
          )}
          <fieldset className="send-mode" aria-label="How to share">
            <button
              type="button"
              aria-pressed={mode === "draft"}
              disabled={busy}
              onClick={() => setMode("draft")}
            >
              Drafts
            </button>
            <button
              type="button"
              aria-pressed={mode === "schedule"}
              disabled={busy || article.mode === "sample"}
              onClick={() => setMode("schedule")}
            >
              Schedule
            </button>
          </fieldset>
          {mode === "schedule" && (
            <div className="schedule-fields">
              <DateTimePicker
                value={start}
                onChange={setStart}
                disabled={busy}
              />
              <p className="input-caption">
                {notes.length > 1 ? "One Note per day · " : ""}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
              {!scheduleValid && (
                <p role="status" className="inline-error">
                  Choose a time between five minutes and 90 days from now.
                </p>
              )}
              {channel?.isQueuePaused && (
                <p role="alert" className="inline-error">
                  Resume this channel in Buffer to schedule.
                </p>
              )}
            </div>
          )}
          {article.mode === "sample" && (
            <p className="input-caption">
              Examples can only be saved as drafts.
            </p>
          )}
          <details className="review-details">
            <summary>
              {notes.length} {notes.length === 1 ? "Note" : "Notes"}
              <ChevronDown size={14} />
            </summary>
            <ol className="approved-preview">
              {notes.map((note, index) => (
                <li key={note.id}>
                  {mode === "schedule" &&
                    Number.isFinite(schedule[index]?.getTime()) && (
                      <span className="publishing-date">
                        {schedule[index].toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    )}
                  {note.text}
                </li>
              ))}
            </ol>
          </details>
          <div className="dialog-actions">
            <button
              type="button"
              className="text-button"
              onClick={onExport}
              disabled={busy}
            >
              Export
            </button>
            <Button
              onClick={send}
              disabled={
                busy ||
                formatted ||
                !notes.length ||
                !channelId ||
                channel?.isDisconnected ||
                channel?.isLocked ||
                history.isPending ||
                history.isError ||
                (mode === "schedule" &&
                  (!scheduleValid || channel?.isQueuePaused))
              }
            >
              {busy ? <LoaderCircle size={15} className="spinner" /> : null}
              {mode === "draft"
                ? "Save drafts"
                : `Schedule ${notes.length} ${notes.length === 1 ? "Note" : "Notes"}`}
            </Button>
          </div>
        </>
      )}
      {history.isError && (
        <p role="alert" className="inline-error">
          Couldn’t load activity.{" "}
          <button type="button" onClick={() => void history.refetch()}>
            Try again
          </button>
        </p>
      )}
      {receipts.length > 0 && (
        <details className="activity-details" open={sent || undefined}>
          <summary>
            Activity
            <ChevronDown size={14} />
          </summary>
          <div className="history-heading">
            <span />{" "}
            <button
              type="button"
              className="icon-button"
              aria-label="Refresh activity"
              disabled={busy}
              onClick={refresh}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          {receipts.map((receipt) => (
            <div className="delivery-row" key={receipt.id}>
              <div>
                <span>
                  Note{" "}
                  {article.notes.findIndex(
                    (note) => note.id === receipt.noteId,
                  ) + 1}{" "}
                  · {statusLabel(receipt.status)}
                </span>
                {receipt.dueAt && receipt.status !== "draft" && (
                  <small>{new Date(receipt.dueAt).toLocaleString()}</small>
                )}
                {receipt.error && <p>{receipt.error}</p>}
              </div>
              {["draft", "scheduled", "error", "needs_approval"].includes(
                receipt.status,
              ) &&
                receipt.bufferPostId && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => setCancelId(receipt.id)}
                  >
                    {receipt.status === "draft" ? "Remove" : "Cancel"}
                  </button>
                )}
            </div>
          ))}
        </details>
      )}
      {cancelId && (
        <div className="cancel-confirm">
          <p>Remove this Note from Buffer?</p>
          <div className="dialog-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setCancelId(null)}
            >
              Keep
            </button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => cancel(cancelId)}
            >
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BufferPreferences({
  beforeConnect,
}: {
  beforeConnect: () => Promise<void>;
}) {
  const client = useQueryClient();
  const connection = useQuery(connectionQuery);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  async function disconnect() {
    setBusy(true);
    try {
      const response = await fetch("/api/buffer", { method: "DELETE" });
      if (!response.ok) throw new Error("Couldn’t disconnect. Try again.");
      await client.invalidateQueries({ queryKey: ["buffer-connection"] });
      setConfirm(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t disconnect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="buffer-preferences">
      <div className="settings-connection">
        <div>
          <span>Buffer</span>
          <small>
            {connection.isPending
              ? "Connecting…"
              : connection.data?.connected
                ? connection.data.accountName
                : "Not connected"}
          </small>
        </div>
        {connection.data?.connected ? (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="text-button"
            disabled={busy || !connection.data?.configured}
            onClick={() => {
              setBusy(true);
              void connectBuffer(beforeConnect).catch((cause) => {
                setError(cause.message);
                setBusy(false);
              });
            }}
          >
            Connect
          </button>
        )}
      </div>
      {(error || connection.error) && (
        <p role="alert" className="inline-error">
          {error || connection.error?.message}
        </p>
      )}
      {confirm && (
        <div className="cancel-confirm">
          <p>Disconnect Buffer? Scheduled Notes won’t be cancelled.</p>
          <div className="dialog-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setConfirm(false)}
            >
              Keep connected
            </button>
            <Button variant="secondary" disabled={busy} onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
