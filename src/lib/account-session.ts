import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bufferAccounts, bufferConnections } from "@/db/schema";
import { readSession } from "./session";

// A guest cookie exists only to finish OAuth. It is not an authenticated account.
export async function readAccountSession() {
  const workspace = await readSession();
  if (!workspace) return null;
  const [account] = await db()
    .select({ id: bufferAccounts.accountId })
    .from(bufferAccounts)
    .innerJoin(
      bufferConnections,
      eq(bufferConnections.accountId, bufferAccounts.accountId),
    )
    .where(
      and(
        eq(bufferAccounts.workspaceId, workspace.id),
        eq(bufferConnections.workspaceId, workspace.id),
      ),
    );
  return account ? workspace : null;
}
