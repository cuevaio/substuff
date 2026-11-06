"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Brand, Mark } from "@/components/brand";
import { connectBuffer, connectionQuery } from "@/components/buffer-panel";
import { ArrowRight } from "@/components/icons";
import { SignOutButton } from "@/components/publication-settings";
import { Button } from "@/components/ui/button";
import { hasSubstackChannel } from "@/lib/onboarding";

export function AccountGate({
  children,
  initialMessage = "",
}: {
  children: React.ReactNode;
  initialMessage?: string;
}) {
  const connection = useQuery({ ...connectionQuery, retry: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialMessage);
  if (connection.isPending)
    return (
      <div className="boot" role="status" aria-label="Opening substuff">
        <Mark />
      </div>
    );
  if (
    connection.data?.connected &&
    hasSubstackChannel(connection.data.channels)
  )
    return children;
  const connected = connection.data?.connected;
  return (
    <div className="welcome-shell">
      <header className="welcome-header">
        <Brand />
        <a href="/privacy" className="text-button">
          Privacy
        </a>
      </header>
      <main id="main" className="welcome">
        <div className="welcome-copy">
          <h1>
            {connected ? "Connect your Substack." : "Your writing, continued."}
          </h1>
          <p>
            {connected
              ? "Add your Substack channel in Buffer, then come back here."
              : "Turn your published Substack posts into Notes that sound like you."}
          </p>
          {connected ? (
            <>
              <Button asChild>
                <a
                  href="https://publish.buffer.com/channels"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Buffer <ArrowRight size={15} />
                </a>
              </Button>
              <button
                type="button"
                className="text-button"
                onClick={() => void connection.refetch()}
              >
                I’ve connected Substack
              </button>
              <SignOutButton beforeSignOut={async () => {}} />
            </>
          ) : (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await connectBuffer(async () => {});
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Couldn’t start sign-in.",
                  );
                  setBusy(false);
                }
              }}
            >
              {busy ? "Connecting…" : "Continue with Buffer"}
              <ArrowRight size={15} />
            </Button>
          )}
          <p className="input-caption">
            {connected
              ? "Your saved writing stays safe."
              : "Connect your Substack channel through Buffer to get started."}
          </p>
          {(error || connection.error || connection.data?.error) && (
            <p className="inline-error" role="alert">
              {error || connection.error?.message || connection.data?.error}{" "}
              <button type="button" onClick={() => void connection.refetch()}>
                Try again
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export function SignInPage({ message = "" }: { message?: string }) {
  return (
    <AccountGate initialMessage={message}>
      <main className="welcome">
        <div className="welcome-copy">
          {message && <p role="status">{message}</p>}
          <a className="button primary" href="/onboarding">
            Open workspace
          </a>
        </div>
      </main>
    </AccountGate>
  );
}
