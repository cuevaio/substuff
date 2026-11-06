"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BufferPreferences } from "@/components/buffer-panel";
import {
  AutoPublishSettings,
  PublicationSettings,
  SignOutButton,
} from "@/components/publication-settings";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";

export function SettingsPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main id="main" className="page-content narrow-page">
      <h1>Settings</h1>
      <BufferPreferences beforeConnect={workspace.flush} />
      <PublicationSettings
        beforeChange={workspace.flush}
        onConnect={() => router.push("/import")}
      />
      <AutoPublishSettings beforeChange={workspace.flush} />
      <div className="settings-links">
        <Link href="/privacy" className="text-button">
          Privacy
        </Link>
        <SignOutButton beforeSignOut={workspace.flush} />
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() => setConfirm(!confirm)}
      >
        Clear workspace
      </button>
      {confirm && (
        <div className="clear-confirm">
          <p>
            Delete imported posts and edits? Scheduled Notes stay in Buffer.
            Feed and auto-publish preferences won’t change.
          </p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await workspace.clear();
                router.push("/onboarding");
                router.refresh();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Couldn’t clear your writing.",
                );
                setBusy(false);
              }
            }}
          >
            Delete posts and edits
          </Button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Keep writing
          </button>
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
