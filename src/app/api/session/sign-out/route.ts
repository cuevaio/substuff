import { NextResponse } from "next/server";
import { sameOrigin, signOutSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to sign out." },
      { status: 403 },
    );
  await signOutSession();
  return NextResponse.json(
    { signedOut: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
