import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bufferConnections } from "@/db/schema";
import { seal, unseal } from "./crypto";

export class BufferError extends Error {
  constructor(
    message: string,
    public status = 502,
    public uncertain = false,
  ) {
    super(message);
  }
}

export const tokenSchema = z.object({
  access_token: z.string().min(10),
  refresh_token: z.string().min(10),
  expires_in: z.number().positive(),
  scope: z.string(),
});
export function bufferConfigured() {
  return Boolean(
    process.env.BUFFER_CLIENT_ID &&
      process.env.BUFFER_CLIENT_SECRET &&
      process.env.BUFFER_REDIRECT_URI &&
      process.env.TOKEN_ENCRYPTION_KEY,
  );
}

export async function exchangeToken(parameters: Record<string, string>) {
  const response = await fetch("https://auth.buffer.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.BUFFER_CLIENT_ID ?? "",
      client_secret: process.env.BUFFER_CLIENT_SECRET ?? "",
      ...parameters,
    }),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new BufferError("Please reconnect Buffer to continue.", 401);
  const token = tokenSchema.parse(await response.json());
  if (
    !["account:read", "posts:read", "posts:write"].every((scope) =>
      token.scope.split(" ").includes(scope),
    )
  )
    throw new BufferError(
      "Buffer didn’t grant the required permissions. Please reconnect.",
      401,
    );
  return token;
}

export async function accessToken(workspaceId: string) {
  const [connection] = await db()
    .select()
    .from(bufferConnections)
    .where(eq(bufferConnections.workspaceId, workspaceId));
  if (!connection || connection.state === "reauth")
    throw new BufferError("Connect Buffer to continue.", 401);
  if (connection.expiresAt.getTime() > Date.now() + 60000)
    return unseal(connection.accessToken, `${workspaceId}:access`);
  // Refresh tokens are single-use. A persisted claim prevents concurrent replay.
  // An interrupted/uncertain refresh requires reconnecting, never replaying the old token.
  if (connection.state === "refreshing")
    throw new BufferError(
      "Your Buffer connection is refreshing. Try again shortly; reconnect if this persists.",
      409,
    );
  const [claim] = await db()
    .update(bufferConnections)
    .set({ state: "refreshing", refreshStartedAt: new Date() })
    .where(
      and(
        eq(bufferConnections.id, connection.id),
        eq(bufferConnections.version, connection.version),
        eq(bufferConnections.state, "ready"),
      ),
    )
    .returning();
  if (!claim)
    throw new BufferError(
      "Your Buffer connection changed. Please try again.",
      409,
    );
  try {
    const token = await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: unseal(connection.refreshToken, `${workspaceId}:refresh`),
    });
    const [saved] = await db()
      .update(bufferConnections)
      .set({
        accessToken: seal(token.access_token, `${workspaceId}:access`),
        refreshToken: seal(token.refresh_token, `${workspaceId}:refresh`),
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        state: "ready",
        version: connection.version + 1,
        refreshStartedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bufferConnections.id, connection.id),
          eq(bufferConnections.version, connection.version),
          eq(bufferConnections.state, "refreshing"),
        ),
      )
      .returning({ id: bufferConnections.id });
    if (!saved)
      throw new BufferError(
        "Your Buffer connection changed. Please reconnect.",
        401,
      );
    return token.access_token;
  } catch {
    await db()
      .update(bufferConnections)
      .set({ state: "reauth" })
      .where(eq(bufferConnections.id, connection.id));
    throw new BufferError(
      "Buffer needs to be reconnected. Your drafts are safe.",
      401,
    );
  }
}

export async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
  mutation = false,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    throw new BufferError(
      "Buffer didn’t confirm the request. Check Buffer before trying again.",
      502,
      mutation,
    );
  }
  if (response.status === 401)
    throw new BufferError("Please reconnect Buffer.", 401);
  if (response.status === 429)
    throw new BufferError(
      `Buffer is temporarily rate limited. Try again after ${Math.min(86400, Number(response.headers.get("retry-after")) || 60)} seconds.`,
      429,
    );
  if (!response.ok)
    throw new BufferError(
      "Buffer is unavailable. Please try again later.",
      502,
      mutation,
    );
  let payload: { data?: T; errors?: unknown[] };
  try {
    payload = await response.json();
  } catch {
    throw new BufferError(
      "Buffer returned an unreadable response. Check Buffer before trying again.",
      502,
      mutation,
    );
  }
  if (payload.errors?.length || !payload.data)
    throw new BufferError(
      "Buffer couldn’t complete the request. Check your connection and permissions.",
      502,
      mutation,
    );
  return payload.data;
}

export type BufferChannel = {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  organizationId: string;
  timezone: string;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
  allowedActions: string[];
};
type Account = {
  id: string;
  name: string | null;
  organizations: { id: string; name: string }[];
};

export async function accountInfo(token: string) {
  return (
    await graphql<{ account: Account }>(
      token,
      "query { account { id name organizations { id name } } }",
    )
  ).account;
}

export async function substackChannels(workspaceId: string) {
  const token = await accessToken(workspaceId);
  const account = await accountInfo(token);
  const groups = await Promise.all(
    account.organizations.map(async (organization) => {
      const { channels } = await graphql<{ channels: BufferChannel[] }>(
        token,
        "query Channels($input: ChannelsInput!) { channels(input: $input) { id name displayName service organizationId timezone isDisconnected isLocked isQueuePaused allowedActions } }",
        { input: { organizationId: organization.id } },
      );
      return channels
        .filter((channel) => channel.service.toLowerCase() === "substack")
        .map((channel) => ({
          ...channel,
          organizationName: organization.name,
        }));
    }),
  );
  return {
    accountName: account.name || "Buffer account",
    channels: groups.flat(),
  };
}
