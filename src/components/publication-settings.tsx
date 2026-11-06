"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { connectionQuery } from "@/components/buffer-panel";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUTO_POLICY_VERSION } from "@/lib/automation-policy";
import { autoQuery } from "@/lib/client-settings";

export function AutoPublishSettings({
  beforeChange,
}: {
  beforeChange: () => Promise<void>;
}) {
  const client = useQueryClient();
  const settings = useQuery(autoQuery);
  const connection = useQuery(connectionQuery);
  const [confirm, setConfirm] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [count, setCount] = useState("1");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const channels =
    connection.data?.channels?.filter(
      (channel) =>
        !channel.isDisconnected &&
        !channel.isLocked &&
        !channel.isQueuePaused &&
        channel.allowedActions.includes("scheduleUpdates"),
    ) ?? [];
  const selected = channelId || (channels.length === 1 ? channels[0].id : "");
  async function save(enabled: boolean) {
    if (!settings.data) return;
    setBusy(true);
    setError("");
    try {
      if (enabled) await beforeChange();
      const response = await fetch("/api/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          version: settings.data.version,
          ...(enabled
            ? {
                channelId: selected,
                notesPerPost: Number(count),
                confirmed: consent,
                policyVersion: AUTO_POLICY_VERSION,
              }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Couldn’t change auto-publish.");
      client.setQueryData(autoQuery.queryKey, data);
      setConfirm(false);
      setConsent(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t change auto-publish.",
      );
      await client.invalidateQueries({ queryKey: autoQuery.queryKey });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="settings-connection">
        <div>
          <span>Auto-publish</span>
          <small>
            {settings.data?.enabled
              ? `On · up to ${settings.data.notesPerPost} Notes per post`
              : "Off · review before sharing"}
          </small>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={
            busy ||
            !settings.data ||
            (connection.isPending && !settings.data.enabled)
          }
          onClick={() =>
            settings.data?.enabled ? void save(false) : setConfirm(true)
          }
        >
          {settings.data?.enabled ? "Turn off" : "Enable"}
        </button>
      </div>
      {(error || settings.error) && (
        <p className="inline-error" role="alert">
          {error || settings.error?.message}
        </p>
      )}
      {confirm && (
        <Dialog
          title="Publish without review?"
          onClose={() => {
            if (!busy) {
              setConfirm(false);
              setConsent(false);
            }
          }}
        >
          <p className="dialog-description">
            New imports will publish AI-written Notes immediately. Existing
            imported posts are not included.
          </p>
          {!channels.length ? (
            <p className="inline-error">
              Connect an active Substack channel in Buffer first.
            </p>
          ) : (
            <>
              <Select
                value={selected}
                onValueChange={setChannelId}
                disabled={busy}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Auto-publish channel"
                >
                  <SelectValue placeholder="Choose Substack" />
                </SelectTrigger>
                <SelectContent position="popper" style={{ zIndex: 80 }}>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.displayName || channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="field-label" htmlFor="auto-note-count">
                Notes per post
              </label>
              <Select value={count} onValueChange={setCount} disabled={busy}>
                <SelectTrigger id="auto-note-count" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" style={{ zIndex: 80 }}>
                  {[1, 2, 3].map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      Up to {count} {count === 1 ? "Note" : "Notes"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="publishing-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  I allow these AI-written Notes to publish publicly without
                  individual review.
                </span>
              </label>
            </>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setConfirm(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <Button
              onClick={() => save(true)}
              disabled={!consent || !selected || busy}
            >
              Enable auto-publish
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function SignOutButton({
  beforeSignOut,
}: {
  beforeSignOut: () => Promise<void>;
}) {
  const client = useQueryClient();
  const connection = useQuery(connectionQuery);
  const automatic = useQuery(autoQuery);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true);
    try {
      await beforeSignOut();
      const response = await fetch("/api/session/sign-out", { method: "POST" });
      if (!response.ok) throw new Error("Couldn’t sign out. Try again.");
      localStorage.removeItem("substuff.workspace.v1");
      client.clear();
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t sign out.");
      setBusy(false);
    }
  }
  if (!connection.data?.connected) return null;
  return (
    <>
      <button
        type="button"
        className="text-button sign-out-button"
        onClick={() => setConfirm(true)}
      >
        Sign out
      </button>
      {confirm && (
        <div className="cancel-confirm">
          <p>
            Your posts stay saved. Sign in with Buffer to restore them.
            {automatic.data?.enabled
              ? " Auto-publish keeps running until you turn it off."
              : ""}
          </p>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Stay signed in
            </button>
            <Button variant="secondary" disabled={busy} onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function PublicationSettings({
  beforeChange,
  onConnect,
}: {
  beforeChange: () => Promise<void>;
  onConnect: () => void;
}) {
  const client = useQueryClient();
  const automatic = useQuery(autoQuery);
  const feed = useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
      const response = await fetch("/api/feed");
      if (!response.ok) throw new Error("Couldn’t open your feed.");
      return response.json() as Promise<{
        publication: {
          title: string;
          url: string;
          error: string | null;
        } | null;
        jobs: { sourceUrl: string; state: string; error: string | null }[];
      }>;
    },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [disconnect, setDisconnect] = useState(false);
  async function act(method: "PATCH" | "DELETE") {
    setBusy(true);
    setError("");
    try {
      await beforeChange();
      const response = await fetch("/api/feed", { method });
      const data = await response.json();
      if (!response.ok || data.error)
        throw new Error(data.error || "Couldn’t update this feed.");
      await client.invalidateQueries({ queryKey: ["feed"] });
      if (method === "PATCH") window.location.reload();
      else setDisconnect(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t update this feed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="publication-settings">
      <div className="settings-connection">
        <div>
          <span>Publication</span>
          <small>
            {feed.data?.publication
              ? `${feed.data.publication.title} · checks daily`
              : "Not connected"}
          </small>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={busy || feed.isPending}
          onClick={
            feed.data?.publication ? () => setDisconnect(true) : onConnect
          }
        >
          {feed.data?.publication ? "Disconnect" : "Connect"}
        </button>
      </div>
      {feed.data?.publication && (
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => act("PATCH")}
        >
          {busy
            ? "Checking…"
            : automatic.data?.enabled
              ? "Check & publish"
              : "Check now"}
        </button>
      )}
      {(error || feed.error || feed.data?.publication?.error) && (
        <p className="inline-error" role="alert">
          {error || feed.error?.message || feed.data?.publication?.error}
        </p>
      )}
      {feed.data?.jobs.some((job) =>
        ["failed", "attention"].includes(job.state),
      ) && (
        <details className="activity-details">
          <summary>Import activity</summary>
          {feed.data.jobs
            .filter((job) => job.error)
            .map((job) => (
              <p className="input-caption" key={job.sourceUrl}>
                {job.error}
              </p>
            ))}
        </details>
      )}
      {disconnect && (
        <div className="cancel-confirm">
          <p>
            Disconnect this feed? Saved Notes stay in your workspace. A send
            already in progress may finish.
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setDisconnect(false)}
            >
              Keep connected
            </button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act("DELETE")}
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
