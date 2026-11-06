import { createGateway } from "@ai-sdk/gateway";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { articleInput, generatedNotes, isGrounded } from "@/lib/content";
import { editorialPrompt, isSummaryVoice } from "@/lib/editorial";
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
          "AI writing isn’t connected yet. You can start with excerpts instead.",
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
          error:
            "That’s today’s writing limit. Your existing drafts are safe; you can still start with excerpts.",
        },
        { status: 429 },
      );
    const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
    const { output } = await generateText({
      model: gateway(process.env.AI_MODEL || "google/gemini-2.5-flash-lite"),
      maxOutputTokens: 3000,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(45000),
      output: Output.object({ schema: generatedNotes }),
      system: editorialPrompt,
      prompt: JSON.stringify(input.data),
    });
    if (
      !output.notes.every(
        (note) =>
          isGrounded(note.source, input.data.content) &&
          !isSummaryVoice(note.text, input.data.content),
      )
    )
      throw new Error("Ungrounded source");
    return NextResponse.json(output, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "We couldn’t create reliable drafts this time. Nothing was changed. Try again, or start with excerpts.",
      },
      { status: 502 },
    );
  }
}
