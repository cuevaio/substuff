import { createGateway } from "@ai-sdk/gateway";
import { generateText, Output } from "ai";
import { editorialPrompt } from "./editorial";
import { generateWithFallback, safeDiagnostic } from "./generate";
import {
  referencedDrafts,
  resolveSources,
  sourcePassages,
} from "./source-passages";

export async function writeNotes(input: { title: string; content: string }) {
  if (!process.env.AI_GATEWAY_API_KEY)
    throw new Error("Writing is unavailable");
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const abortSignal = AbortSignal.timeout(50000);
  const passages = sourcePassages(input.content);
  if (!passages.length) throw new Error("Ungrounded source");
  return generateWithFallback(
    input.content,
    process.env.AI_MODEL || "google/gemini-2.5-flash-lite",
    process.env.AI_FALLBACK_MODEL || "openai/gpt-4.1-mini",
    async (model) => {
      const result = await generateText({
        model: gateway(model),
        maxOutputTokens: 3000,
        maxRetries: 0,
        abortSignal,
        output: Output.object({ schema: referencedDrafts }),
        system: editorialPrompt,
        prompt: JSON.stringify({ title: input.title, passages }),
      });
      return resolveSources(result.output, passages);
    },
    (cause) => console.warn("substuff.generation_retry", safeDiagnostic(cause)),
  );
}
