import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { accessToken, BufferError, graphql } from "@/lib/buffer";
import { readSession, sameOrigin } from "@/lib/session";

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/buffer/deliveries/[id]">,
) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Open substuff to cancel a post." },
      { status: 403 },
    );
  try {
    const workspace = await readSession();
    if (!workspace)
      return NextResponse.json(
        { error: "Reconnect Buffer to continue." },
        { status: 401 },
      );
    const { id } = await context.params;
    const [delivery] = await db()
      .select()
      .from(deliveries)
      .where(
        and(eq(deliveries.id, id), eq(deliveries.workspaceId, workspace.id)),
      );
    if (!delivery?.bufferPostId)
      return NextResponse.json(
        { error: "This post wasn’t found." },
        { status: 404 },
      );
    if (delivery.status === "cancelled")
      return NextResponse.json({ status: "cancelled" });
    const token = await accessToken(workspace.id);
    const { post } = await graphql<{ post: { status: string } }>(
      token,
      "query($input: PostInput!) { post(input: $input) { status } }",
      { input: { id: delivery.bufferPostId } },
    );
    if (
      !["draft", "scheduled", "error", "needs_approval"].includes(post.status)
    )
      return NextResponse.json(
        {
          error:
            "This post is already publishing or published. Manage it in Substack.",
        },
        { status: 409 },
      );
    const { deletePost } = await graphql<{
      deletePost: { __typename: string };
    }>(
      token,
      "mutation($input: DeletePostInput!) { deletePost(input: $input) { __typename ... on DeletePostSuccess { id } ... on MutationError { message } } }",
      { input: { id: delivery.bufferPostId } },
      true,
    );
    if (deletePost.__typename !== "DeletePostSuccess")
      throw new BufferError(
        "Buffer couldn’t cancel this post. Check it there before trying again.",
      );
    await db()
      .update(deliveries)
      .set({ status: "cancelled", error: null })
      .where(eq(deliveries.id, delivery.id));
    return NextResponse.json({ status: "cancelled" });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof BufferError
            ? cause.message
            : "Cancellation wasn’t confirmed. Check Buffer before trying again.",
      },
      { status: cause instanceof BufferError ? cause.status : 503 },
    );
  }
}
