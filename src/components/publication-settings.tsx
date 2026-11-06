"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { connectionQuery } from "@/components/buffer-panel";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import { AUTO_POLICY_VERSION } from "@/lib/automation-policy";
import { autoQuery } from "@/lib/client-settings";

export function AutoApproveSettings({
  beforeChange,
}: {
  beforeChange: () => Promise<void>;
}) {
  const client = useQueryClient();
  const settings = useQuery(autoQuery);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
                confirmed: true,
                policyVersion: AUTO_POLICY_VERSION,
              }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Couldn’t change auto-approve.");
      client.setQueryData(autoQuery.queryKey, data);
      setConfirm(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t change auto-approve.",
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
          <span>Auto-approve</span>
          <small>
            {settings.data?.enabled
              ? "On · new Notes start approved"
              : "Off · approve Notes yourself"}
          </small>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={busy || !settings.data}
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
          title="Auto-approve new Notes?"
          onClose={() => {
            if (!busy) {
              setConfirm(false);
            }
          }}
        >
          <p className="dialog-description">
            New generated Notes will start approved. You can unapprove, edit,
            and approve them again. Nothing is published or scheduled until you
            choose to share. Existing Notes won’t change.
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
              onClick={() => setConfirm(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <Button onClick={() => save(true)} disabled={busy}>
              Enable auto-approve
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
              ? " Auto-approve stays on for new Notes. Nothing publishes automatically."
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
          {busy ? "Checking…" : "Check now"}
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
            Disconnect this feed? Saved Notes stay in your workspace. Notes
            already scheduled in Buffer won’t be cancelled.
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
