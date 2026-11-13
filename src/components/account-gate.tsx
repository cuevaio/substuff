"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Brand, Mark } from "@/components/brand";
import { connectBuffer, connectionQuery } from "@/components/buffer-panel";
import { ArrowRight } from "@/components/icons";
import { SignOutButton } from "@/components/publication-settings";
import { Button } from "@/components/ui/button";
import { hasSubstackChannel } from "@/lib/onboarding";

const notePreviews = [
  "The best work begins before the first draft.",
  "A good idea deserves a shorter sentence.",
  "Keep the thought. Lose the noise.",
] as const;

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
    <div className="landing-shell">
      <header className="landing-header">
        <Brand />
        <a href="/privacy" className="landing-privacy">
          Privacy
        </a>
      </header>
      <main id="main" className="landing-main">
        <section className="landing-copy" aria-labelledby="landing-title">
          <p className="landing-kicker">For writers with something to say</p>
          <h1 id="landing-title">
            {connected
              ? "Connect your Substack."
              : "One post. A week of Notes."}
          </h1>
          <p className="landing-description">
            {connected
              ? "Add your Substack channel in Buffer, then come back here."
              : "Turn the thinking you have already published into clear, considered Notes that still sound like you."}
          </p>
          {connected ? (
            <div className="landing-actions">
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
            </div>
          ) : (
            <div className="landing-actions">
              <Button
                className="landing-primary"
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
                {busy ? "Preparing your space…" : "Connect with Buffer"}
                <ArrowRight size={15} />
              </Button>
              <span className="landing-caption">
                Your writing stays yours. Start with one connection.
              </span>
            </div>
          )}
          {(error || connection.error || connection.data?.error) && (
            <p className="inline-error" role="alert">
              {error || connection.error?.message || connection.data?.error}{" "}
              <button type="button" onClick={() => void connection.refetch()}>
                Try again
              </button>
            </p>
          )}
        </section>
        {!connected && <LandingStory busy={busy} />}
      </main>
    </div>
  );
}

function LandingStory({ busy }: { busy: boolean }) {
  return (
    <section
      className={`landing-story${busy ? " is-preparing" : ""}`}
      aria-label="How substuff turns a post into Notes"
    >
      <article className="source-post">
        <div className="source-meta">
          <span className="source-avatar">S</span>
          <span>Studio Notes</span>
          <time>Today</time>
        </div>
        <h2>Build a practice that leaves room for thinking.</h2>
        <p>
          Most creative systems fail because they ask us to begin from nothing,
          every single time.
        </p>
        <div className="source-lines">
          <i />
          <i />
          <i />
        </div>
        <span className="source-link">
          Read on Substack <ArrowRight size={13} />
        </span>
      </article>
      <div className="notes-stage">
        <div className="note-stack">
          {notePreviews.map((note, index) => (
            <article
              className="note-preview"
              key={note}
              style={{ "--note-index": index } as React.CSSProperties}
            >
              <div className="note-meta">
                <span className="note-avatar">S</span>
                <span>Studio Notes</span>
                <time>Now</time>
              </div>
              <p>{note}</p>
              <span className="note-link">Note</span>
            </article>
          ))}
        </div>
      </div>
    </section>
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
