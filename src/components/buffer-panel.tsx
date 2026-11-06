"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BufferChannel } from "@/lib/buffer";
import type { Article } from "@/lib/content";
import type { DeliveryReceipt } from "@/lib/delivery";

type Connection = {
  configured: boolean;
  connected: boolean;
  accountName?: string;
  channels?: (BufferChannel & { organizationName: string })[];
  error?: string;
};

export async function connectBuffer(beforeConnect: () => Promise<void>) {
  await beforeConnect();
  const response = await fetch("/api/buffer/connect", { method: "POST" });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Buffer connection couldn’t start.");
  const url = new URL(data.url);
  if (url.origin !== "https://auth.buffer.com")
    throw new Error("Unexpected authorization destination.");
  window.location.assign(url.toString());
}

async function textHash(text: string) {
  const result = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(result), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return localInput(date);
}
function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function dates(start: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return date;
  });
}
function statusLabel(status: string) {
  return (
    (
      {
        draft: "Draft in Buffer",
        scheduled: "Scheduled",
        sending: "Publishing",
        sent: "Published",
        error: "Needs attention",
        creating: "Waiting for confirmation",
        unknown: "Check Buffer",
        cancelled: "Cancelled",
        needs_approval: "Awaiting Buffer approval",
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
  const [connection, setConnection] = useState<Connection | null>(null);
  const [channelId, setChannelId] = useState("");
  const [mode, setMode] = useState<"draft" | "schedule">("draft");
  const [start, setStart] = useState(tomorrow);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipts, setReceipts] = useState<DeliveryReceipt[]>([]);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const notes = article.notes.filter((note) => note.approved);
  const channel = connection?.channels?.find(
    (channel) => channel.id === channelId,
  );
  const schedule = start ? dates(start, notes.length) : [];
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const loadHistory = useCallback(
    async (sync = false) => {
      const response = await fetch(
        `/api/buffer/deliveries?articleId=${encodeURIComponent(article.id)}${sync ? "&sync=true" : ""}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Publishing history couldn’t be loaded.");
      setReceipts(data.deliveries);
      if (data.warning) setError(data.warning);
    },
    [article.id],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/buffer")
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        setConnection(data);
        if (data.channels?.length === 1) setChannelId(data.channels[0].id);
        if (data.error) setError(data.error);
      })
      .catch(() => {
        if (active)
          setError(
            "Buffer couldn’t be reached. You can still export your Notes.",
          );
      });
    void loadHistory().catch(() => {});
    return () => {
      active = false;
    };
  }, [loadHistory]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      await connectBuffer(beforeSend);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connection failed.");
      setBusy(false);
    }
  }

  async function send() {
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
        throw new Error(
          data.error ||
            "Buffer didn’t confirm the request. Refresh publishing history before trying again.",
        );
      setSent(true);
      await loadHistory();
      if (
        data.deliveries.some((receipt: DeliveryReceipt) =>
          ["unknown", "error", "creating"].includes(receipt.status),
        )
      )
        setError(
          "Not every Note was confirmed. Review the individual statuses below before sending anything again.",
        );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The request couldn’t be completed.",
      );
      await loadHistory().catch(() => {});
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
        throw new Error(data.error || "Cancellation wasn’t confirmed.");
      setCancelId(null);
      await loadHistory();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Cancellation failed. Check Buffer.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="buffer-panel">
      <p className="dialog-description">
        {notes.length} approved {notes.length === 1 ? "Note" : "Notes"}. Nothing
        goes out until you choose.
      </p>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {!connection ? (
        <p className="connection-loading">
          <LoaderCircle size={15} className="spinner" /> Checking Buffer…
        </p>
      ) : !connection.connected ? (
        <>
          <ol className="approved-preview">
            {notes.map((note) => (
              <li key={note.id}>{note.text}</li>
            ))}
          </ol>
          <div className="buffer-notice">
            <span className="buffer-mark">≋</span>
            <div>
              <span>Bring your Notes to Buffer.</span>
              <p>
                Connect once, choose your Substack, then save drafts or
                schedule. Your account is never shared with the writing model.
              </p>
            </div>
          </div>
          <div className="dialog-actions">
            <button type="button" className="text-button" onClick={onExport}>
              <ArrowDownToLine size={14} /> Export instead
            </button>
            <Button disabled={busy || !connection.configured} onClick={connect}>
              {busy ? <LoaderCircle size={15} className="spinner" /> : null}
              Connect Buffer <ArrowRight size={15} />
            </Button>
          </div>
          {!connection.configured && (
            <p className="privacy-note">
              Buffer connection is temporarily unavailable. Your Notes are safe.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="connection-summary">
            <Check size={14} />
            <span>{connection.accountName}</span>
            <a
              href="https://publish.buffer.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open Buffer <ArrowUpRight size={12} />
            </a>
          </div>
          {!connection.channels?.length ? (
            <p className="privacy-note">
              No Substack channel was found.{" "}
              <a
                href="https://publish.buffer.com/"
                target="_blank"
                rel="noreferrer"
              >
                Connect your Substack inside Buffer
              </a>
              , then reopen this review.
            </p>
          ) : (
            <>
              <label className="field-label" htmlFor="buffer-channel">
                Substack
              </label>
              <select
                id="buffer-channel"
                value={channelId}
                onChange={(event) => {
                  setChannelId(event.target.value);
                  setConfirmed(false);
                  setSent(false);
                }}
                disabled={busy}
              >
                <option value="" disabled>
                  Choose a channel
                </option>
                {connection.channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.displayName || channel.name} ·{" "}
                    {channel.organizationName}
                    {channel.isDisconnected
                      ? " (disconnected)"
                      : channel.isLocked
                        ? " (locked)"
                        : channel.isQueuePaused
                          ? " (paused)"
                          : ""}
                  </option>
                ))}
              </select>
              <fieldset className="send-mode" aria-label="How to send">
                <button
                  type="button"
                  aria-pressed={mode === "draft"}
                  onClick={() => {
                    setMode("draft");
                    setConfirmed(false);
                    setSent(false);
                  }}
                  disabled={busy}
                >
                  Save as drafts
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "schedule"}
                  onClick={() => {
                    setMode("schedule");
                    setConfirmed(false);
                    setSent(false);
                  }}
                  disabled={busy || article.mode === "sample"}
                >
                  Schedule Notes
                </button>
              </fieldset>
              {article.mode === "sample" && (
                <p className="privacy-note">
                  Sample Notes can be saved as drafts for testing, but can’t be
                  publicly scheduled.
                </p>
              )}
              {mode === "schedule" && (
                <>
                  <label className="field-label" htmlFor="first-note-time">
                    First Note
                  </label>
                  <input
                    id="first-note-time"
                    type="datetime-local"
                    value={start}
                    min={localInput(new Date(Date.now() + 6 * 60000))}
                    onChange={(event) => {
                      setStart(event.target.value);
                      setConfirmed(false);
                      setSent(false);
                    }}
                    disabled={busy}
                  />
                  <p className="input-caption">
                    One Note per day, at the same local time. {zone}
                  </p>
                </>
              )}
              <ol className="approved-preview send-preview">
                {notes.map((note, index) => (
                  <li key={note.id}>
                    {mode === "schedule" &&
                      schedule[index] &&
                      Number.isFinite(schedule[index].getTime()) && (
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
              {mode === "schedule" && (
                <label className="publishing-consent">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>
                    I approve these Notes and times for publishing to{" "}
                    {channel?.displayName ||
                      channel?.name ||
                      "my selected Substack"}
                    .
                  </span>
                </label>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={onExport}
                  disabled={!notes.length}
                >
                  <ArrowDownToLine size={14} /> Export
                </button>
                <Button
                  onClick={send}
                  disabled={
                    busy ||
                    sent ||
                    !notes.length ||
                    !channelId ||
                    channel?.isDisconnected ||
                    channel?.isLocked ||
                    (mode === "schedule" &&
                      (!confirmed || !start || channel?.isQueuePaused))
                  }
                >
                  {busy ? <LoaderCircle size={15} className="spinner" /> : null}
                  {sent
                    ? "Request recorded"
                    : mode === "draft"
                      ? "Save in Buffer"
                      : `Schedule ${notes.length} ${notes.length === 1 ? "Note" : "Notes"}`}
                  {!busy && !sent && <ArrowRight size={15} />}
                </Button>
              </div>
            </>
          )}
        </>
      )}
      {receipts.length > 0 && (
        <section className="delivery-history" aria-label="Publishing history">
          <div className="history-heading">
            <span>In Buffer</span>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void loadHistory(true)
                  .catch((cause) => setError(cause.message))
                  .finally(() => setBusy(false));
              }}
            >
              <RotateCcw size={12} /> Refresh status
            </button>
          </div>
          {receipts.map((receipt) => (
            <div key={receipt.id} className="delivery-row">
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
                    onClick={() => setCancelId(receipt.id)}
                    disabled={busy}
                  >
                    {receipt.status === "draft" ? "Remove draft" : "Cancel"}
                  </button>
                )}
            </div>
          ))}
          <p className="privacy-note">
            Editing in substuff doesn’t change a version already in Buffer. A
            recorded version is never sent twice automatically.
          </p>
        </section>
      )}
      {cancelId && (
        <div className="cancel-confirm">
          <p>
            Remove this version from Buffer? A published post can’t be removed
            here.
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setCancelId(null)}
            >
              Keep it
            </button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => cancel(cancelId)}
            >
              Remove from Buffer
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
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    fetch("/api/buffer")
      .then((response) => response.json())
      .then(setConnection)
      .catch(() => setError("Buffer status couldn’t be loaded."));
  }, []);
  async function disconnect() {
    setBusy(true);
    try {
      const response = await fetch("/api/buffer", { method: "DELETE" });
      if (!response.ok)
        throw new Error("Disconnection wasn’t confirmed. Try again.");
      setConnection((previous) =>
        previous ? { ...previous, connected: false } : null,
      );
      setConfirm(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Disconnection failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="buffer-preferences">
      <p>
        {connection?.connected
          ? `Connected as ${connection.accountName}. Reconnecting the same Buffer account opens your saved workspace on another device.`
          : "Connect Buffer to save drafts or schedule approved Notes to Substack."}
      </p>
      {error && <p role="alert">{error}</p>}
      {connection?.connected ? (
        <>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            Disconnect Buffer
          </button>
          {confirm && (
            <>
              <p>
                This removes substuff’s stored credentials. Posts already in
                Buffer aren’t cancelled.
              </p>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={disconnect}
              >
                Confirm disconnect
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setConfirm(false)}
              >
                Keep connected
              </button>
            </>
          )}
        </>
      ) : (
        <button
          type="button"
          className="text-button"
          disabled={busy || !connection?.configured}
          onClick={() => {
            setBusy(true);
            void connectBuffer(beforeConnect).catch((cause) => {
              setError(cause.message);
              setBusy(false);
            });
          }}
        >
          Connect Buffer <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
