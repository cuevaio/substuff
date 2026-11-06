import { NextResponse } from "next/server";
import { claimQuota } from "@/lib/generation-limit";
import { sameOrigin } from "@/lib/session";
import { ImportError, importSubstackPost } from "@/lib/substack";
import { parseSubstackUrl } from "@/lib/substack-url";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to import a post." },
      { status: 403 },
    );
  let url: string;
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error("input");
    const body = JSON.parse(raw);
    if (typeof body.url !== "string") throw new Error("input");
    url = parseSubstackUrl(body.url).url;
  } catch {
    return NextResponse.json(
      {
        error:
          "Add a published Substack post link, like yourname.substack.com/p/post-title.",
      },
      { status: 400 },
    );
  }
  try {
    if (!process.env.DATABASE_URL || !process.env.RATE_LIMIT_SALT)
      return NextResponse.json(
        { error: "Importing is temporarily unavailable. Try again later." },
        { status: 503 },
      );
    if (!(await claimQuota(request, "import", 40)))
      return NextResponse.json(
        { error: "You’ve reached today’s import limit. Try again tomorrow." },
        { status: 429 },
      );
    const article = await importSubstackPost(url);
    return NextResponse.json(article, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof ImportError
            ? cause.message
            : "We couldn’t open that post. Please try again.",
      },
      { status: cause instanceof ImportError ? cause.status : 502 },
    );
  }
}
