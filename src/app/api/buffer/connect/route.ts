import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { oauthAttempts } from "@/db/schema";
import { bufferConfigured } from "@/lib/buffer";
import { seal } from "@/lib/crypto";
import { claimQuota } from "@/lib/generation-limit";
import { createSession, digest, readSession, sameOrigin } from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to connect Buffer." },
      { status: 403 },
    );
  if (!bufferConfigured())
    return NextResponse.json(
      { error: "Buffer connection isn’t configured yet." },
      { status: 503 },
    );
  try {
    if (!(await claimQuota(request, "oauth", 30)))
      return NextResponse.json(
        { error: "Too many connection attempts. Please try again tomorrow." },
        { status: 429 },
      );
    const workspace = (await readSession()) ?? (await createSession());
    const state = randomBytes(32).toString("hex");
    const verifier = randomBytes(32).toString("base64url");
    await db()
      .insert(oauthAttempts)
      .values({
        stateHash: digest(state),
        workspaceId: workspace.id,
        verifier: seal(verifier, `${workspace.id}:pkce`),
        expiresAt: new Date(Date.now() + 600000),
      });
    const url = new URL("https://auth.buffer.com/auth");
    url.search = new URLSearchParams({
      client_id: process.env.BUFFER_CLIENT_ID ?? "",
      redirect_uri: process.env.BUFFER_REDIRECT_URI ?? "",
      response_type: "code",
      scope: "account:read posts:read posts:write offline_access",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "consent",
    }).toString();
    return NextResponse.json(
      { url: url.toString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Buffer connection couldn’t start. Your drafts are safe." },
      { status: 503 },
    );
  }
}
