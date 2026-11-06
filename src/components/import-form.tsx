"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ImportForm({
  onImport,
}: {
  onImport: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const mutation = useMutation({ mutationFn: onImport });
  return (
    <form
      className="import-form"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(url);
      }}
    >
      <label htmlFor="post-url" className="sr-only">
        Substack post link
      </label>
      <div className="import-input-row">
        <Input
          id="post-url"
          type="url"
          autoComplete="url"
          placeholder="Paste a Substack post link"
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
        <Button type="submit" disabled={!url.trim() || mutation.isPending}>
          {mutation.isPending ? (
            <>
              <LoaderCircle size={16} className="spinner" />
              Importing…
            </>
          ) : (
            <>
              Create Notes
              <ArrowRight size={16} />
            </>
          )}
        </Button>
      </div>
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
