"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { ArrowRight, Check, LoaderCircle } from "@/components/icons";
import { SignOutButton } from "@/components/publication-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { workspaceSchema } from "@/lib/content";
import { onboardingSteps } from "@/lib/onboarding";

export function Onboarding({
  onReady,
  beforeStart,
}: {
  beforeStart: () => Promise<void>;
  onReady: (
    document: ReturnType<typeof workspaceSchema.parse>,
    revision: number,
  ) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const feed = useQuery({
    queryKey: ["onboarding-feed"],
    queryFn: async () => {
      const response = await fetch("/api/feed");
      if (!response.ok) throw new Error("Couldn’t open your publication.");
      return response.json() as Promise<{
        publication: { url: string } | null;
      }>;
    },
  });

  async function start() {
    setBusy(true);
    setError("");
    setStep(0);
    try {
      await beforeStart();
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url || feed.data?.publication?.url }),
        signal: AbortSignal.timeout(170000),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Couldn’t start onboarding.");
      }
      if (!response.body)
        throw new Error(
          "Connection was interrupted. Reload to check your saved Notes.",
        );
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let done = false;
      try {
        while (true) {
          const chunk = await reader.read();
          pending += decoder.decode(chunk.value, { stream: !chunk.done });
          const lines = pending.split("\n");
          pending = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            if (event.error) throw new Error(event.error);
            if (event.step) {
              const index = onboardingSteps.findIndex(
                (step) => step.id === event.step,
              );
              if (index >= 0) setStep((previous) => Math.max(previous, index));
            }
            if (event.done) {
              done = true;
              onReady(workspaceSchema.parse(event.document), event.revision);
            }
          }
          if (chunk.done) break;
        }
      } finally {
        reader.releaseLock();
      }
      if (!done)
        throw new Error(
          "Connection was interrupted. Reload to check your saved Notes before trying again.",
        );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t prepare your Notes.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="welcome-shell">
      <header className="welcome-header">
        <Brand />
        {!busy && <SignOutButton beforeSignOut={async () => {}} />}
      </header>
      <main id="main" className="welcome onboarding">
        <div className="welcome-copy">
          {busy ? (
            <>
              <div className="onboarding-orbit" aria-hidden="true">
                <LoaderCircle className="onboarding-orbit-icon" />
              </div>
              <h1>Making room for your voice.</h1>
              <p>Your first Notes start with your latest published post.</p>
              <ol
                className="onboarding-steps"
                aria-label="Preparing your Notes"
              >
                {onboardingSteps.map((item, index) => (
                  <li
                    key={item.id}
                    data-state={
                      index < step
                        ? "complete"
                        : index === step
                          ? "active"
                          : "waiting"
                    }
                    aria-current={index === step ? "step" : undefined}
                  >
                    {index < step ? (
                      <Check size={16} aria-hidden="true" />
                    ) : index === step ? (
                      <LoaderCircle
                        size={16}
                        className="onboarding-spinner"
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="onboarding-dot" />
                    )}
                    <span>{item.label}</span>
                  </li>
                ))}
              </ol>
              <span className="sr-only" role="status" aria-live="polite">
                {onboardingSteps[step].label}
              </span>
            </>
          ) : (
            <>
              <h1>Let’s get to know your writing.</h1>
              <p>
                Add your publication. We’ll read your latest post, study its
                voice, and suggest a few Notes.
              </p>
              <form
                className="import-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void start();
                }}
              >
                <label htmlFor="publication-url" className="sr-only">
                  Substack publication link
                </label>
                <div className="import-input-row">
                  <Input
                    id="publication-url"
                    type="url"
                    autoComplete="url"
                    placeholder="https://yourname.substack.com"
                    value={url || feed.data?.publication?.url || ""}
                    onChange={(event) => setUrl(event.target.value)}
                    required
                    className="h-[46px]"
                  />
                  <Button
                    type="submit"
                    disabled={!(url || feed.data?.publication?.url)}
                  >
                    Get started <ArrowRight size={15} />
                  </Button>
                </div>
              </form>
              <p className="input-caption">
                Just suggestions. Nothing publishes without your say.
              </p>
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
