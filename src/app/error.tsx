"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="welcome">
      <div className="welcome-copy">
        <h1>Couldn’t open your workspace.</h1>
        <p>Your saved writing hasn’t been changed.</p>
        <Button onClick={retry}>Try again</Button>
      </div>
    </main>
  );
}
