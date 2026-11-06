"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { autoQuery, type ImportIntent } from "@/lib/client-settings";
import { parsePublicationUrl } from "@/lib/substack-url";

export function ImportForm({
  onImport,
}: {
  onImport: (url: string, intent?: ImportIntent) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const client = useQueryClient();
  const settings = useQuery(autoQuery);
  let publication = false;
  try {
    parsePublicationUrl(url);
    publication = true;
  } catch {
    /* A post link or an incomplete input. */
  }
  const mutation = useMutation({
    mutationFn: (url: string) =>
      onImport(url, {
        version: settings.data?.version ?? 0,
      }),
    onError: () => {
      void client.invalidateQueries({ queryKey: autoQuery.queryKey });
    },
  });
  return (
    <form
      className="import-form"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(url);
      }}
    >
      <label htmlFor="post-url" className="sr-only">
        Substack link
      </label>
      <div className="import-input-row">
        <Input
          id="post-url"
          type="url"
          autoComplete="url"
          placeholder="Paste a Substack post or publication link"
          className="h-[46px]"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            mutation.reset();
          }}
          disabled={mutation.isPending}
          maxLength={2048}
          required
        />
        <Button
          type="submit"
          disabled={!url.trim() || mutation.isPending || !settings.data}
        >
          {mutation.isPending ? (
            <>
              <LoaderCircle size={16} className="spinner" />
              {publication ? "Connecting…" : "Importing…"}
            </>
          ) : (
            <>
              {publication ? "Connect feed" : "Create Notes"}
              <ArrowRight size={16} />
            </>
          )}
        </Button>
      </div>
      {settings.data?.enabled && (
        <p className="input-caption">
          Auto-approve is on. New Notes start approved; nothing publishes
          automatically.
        </p>
      )}
      {settings.error && (
        <p role="alert" className="inline-error">
          {settings.error.message}{" "}
          <button type="button" onClick={() => void settings.refetch()}>
            Try again
          </button>
        </p>
      )}
      {mutation.error && (
        <p className="inline-error" role="alert">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Couldn’t import this post. Try again."}
        </p>
      )}
    </form>
  );
}
