import { createGateway } from "@ai-sdk/gateway";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { articleInput, generatedNotes } from "@/lib/content";
import { editorialPrompt } from "@/lib/editorial";
import { generateWithFallback, safeDiagnostic } from "@/lib/generate";
import { claimGeneration } from "@/lib/generation-limit";
import { sameOrigin } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(
    {
      available: Boolean(
        process.env.AI_GATEWAY_API_KEY &&
          process.env.DATABASE_URL &&
          process.env.RATE_LIMIT_SALT,
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Please generate Notes from substuff." },
      { status: 403 },
    );
  if (
    !process.env.AI_GATEWAY_API_KEY ||
    !process.env.DATABASE_URL ||
    !process.env.RATE_LIMIT_SALT
  ) {
    return NextResponse.json(
      {
        error:
          "Creating Notes is temporarily unavailable. Please try again later.",
      },
      { status: 503 },
    );
  }
  const text = await request.text();
  if (text.length > 250000)
    return NextResponse.json(
      { error: "Try a shorter article." },
      { status: 413 },
    );
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "The article couldn’t be read. Please try again." },
      { status: 400 },
    );
  }
  const input = articleInput.safeParse(body);
  if (!input.success)
    return NextResponse.json(
      { error: input.error.issues[0].message },
      { status: 400 },
    );
  try {
    if (!(await claimGeneration(request)))
      return NextResponse.json(
        {
          error: "You’ve reached today’s Note limit. Try again tomorrow.",
        },
        { status: 429 },
      );
    const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
    const abortSignal = AbortSignal.timeout(50000);
    const output = await generateWithFallback(
      input.data.content,
      process.env.AI_MODEL || "google/gemini-2.5-flash-lite",
      process.env.AI_FALLBACK_MODEL || "openai/gpt-4.1-mini",
      async (model) => {
        const result = await generateText({
          model: gateway(model),
          maxOutputTokens: 3000,
          maxRetries: 0,
          abortSignal,
          output: Output.object({ schema: generatedNotes }),
          system: editorialPrompt,
          prompt: JSON.stringify(input.data),
        });
        return result.output;
      },
      (cause) =>
        console.warn("substuff.generation_retry", safeDiagnostic(cause)),
    );
    return NextResponse.json(output, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    // Deliberately exclude error messages, prompts, provider bodies, and credentials.
    console.warn("substuff.generation_failed", safeDiagnostic(cause));
    return NextResponse.json(
      {
        error:
          "We couldn’t create Notes this time. Nothing was changed. Please try again.",
      },
      { status: 502 },
    );
  }
}
