import type { z } from "zod";
import { generatedNotes, isGrounded } from "./content";
import { isSummaryVoice } from "./editorial";

type Drafts = z.infer<typeof generatedNotes>;

export function safeDiagnostic(cause: unknown) {
  const error =
    cause && typeof cause === "object"
      ? (cause as { name?: string; statusCode?: number; message?: string })
      : null;
  return {
    name: error?.name ?? "UnknownError",
    status: error?.statusCode,
    editorialGuard: error?.message === "Ungrounded source",
  };
}

export async function generateWithFallback(
  content: string,
  primary: string,
  fallback: string,
  generate: (model: string) => Promise<unknown>,
  onRetry?: (cause: unknown) => void,
): Promise<Drafts> {
  const models = [...new Set([primary, fallback])];
  let lastError: unknown;
  for (const [index, model] of models.entries()) {
    try {
      const output = generatedNotes.parse(await generate(model));
      if (
        !output.notes.every(
          (note) =>
            isGrounded(note.source, content) &&
            !isSummaryVoice(note.text, content),
        )
      )
        throw new Error("Ungrounded source");
      return output;
    } catch (cause) {
      lastError = cause;
      if (index < models.length - 1) onRetry?.(cause);
    }
  }
  throw lastError;
}
