import { redirect } from "next/navigation";
import { AccountGate } from "@/components/account-gate";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { WorkspaceShell } from "@/components/workspace-shell";
import { readAccountSession } from "@/lib/account-session";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await readAccountSession();
  if (!workspace) redirect("/");
  return (
    <AccountGate>
      <WorkspaceProvider
        initialDocument={workspace.document}
        initialRevision={workspace.revision}
      >
        <WorkspaceShell>{children}</WorkspaceShell>
      </WorkspaceProvider>
    </AccountGate>
  );
}
