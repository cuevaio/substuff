import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bufferConnections } from "@/db/schema";
import { BufferError, bufferConfigured, substackChannels } from "@/lib/buffer";
import { readSession, sameOrigin } from "@/lib/session";

export async function GET() {
  const configured = bufferConfigured();
  try {
    const workspace = await readSession();
    if (!workspace) return NextResponse.json({ configured, connected: false });
    const [connection] = await db()
      .select({ state: bufferConnections.state })
      .from(bufferConnections)
      .where(eq(bufferConnections.workspaceId, workspace.id));
    if (!connection) return NextResponse.json({ configured, connected: false });
    const details = await substackChannels(workspace.id);
    return NextResponse.json(
      { configured, connected: true, ...details },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return NextResponse.json(
      {
        configured,
        connected: false,
        error:
          cause instanceof BufferError
            ? cause.message
            : "Buffer couldn’t be reached. Your drafts are safe.",
      },
      {
        status:
          cause instanceof BufferError && cause.status !== 401
            ? cause.status
            : 200,
      },
    );
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to disconnect Buffer." },
      { status: 403 },
    );
  const workspace = await readSession();
  if (workspace)
    await db()
      .delete(bufferConnections)
      .where(eq(bufferConnections.workspaceId, workspace.id));
  return NextResponse.json({ disconnected: true });
}
