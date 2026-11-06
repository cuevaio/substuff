import { NextResponse } from "next/server";
import { readAccountSession } from "@/lib/account-session";
import { articleInput } from "@/lib/content";
import { safeDiagnostic } from "@/lib/generate";
import { claimGeneration } from "@/lib/generation-limit";
import { sameOrigin } from "@/lib/session";
import { writeNotes } from "@/lib/writer";

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
    if (!(await readAccountSession()))
      return NextResponse.json(
        { error: "Continue with Buffer to create Notes." },
        { status: 401 },
      );
    if (!(await claimGeneration(request)))
      return NextResponse.json(
        {
          error: "You’ve reached today’s Note limit. Try again tomorrow.",
        },
        { status: 429 },
      );
    const output = await writeNotes(input.data);
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
