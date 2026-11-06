import { redirect } from "next/navigation";
import { SignInPage } from "@/components/account-gate";
import { readAccountSession } from "@/lib/account-session";

export default async function Page({ searchParams }: PageProps<"/">) {
  const { buffer } = await searchParams;
  const messages: Record<string, string> = {
    cancelled: "Connection cancelled. Your writing is safe.",
    expired: "This connection attempt expired. Please try again.",
    account:
      "This workspace belongs to another Buffer account. Use a separate browser profile to connect another account.",
    conflict:
      "Your workspace changed in another tab. Reconnect Buffer before continuing.",
    full: "This workspace is full. Open it and export writing before connecting.",
    error: "Buffer connection failed. Please try again.",
    connected_feed:
      "Workspace restored. Reconnect your publication in Settings to confirm its publishing preference.",
  };
  const message = typeof buffer === "string" ? messages[buffer] : undefined;
  if (message) return <SignInPage message={message} />;
  const workspace = await readAccountSession();
  if (workspace) {
    const articles = workspace.document.articles.filter(
      (article) => article.mode !== "sample",
    );
    const article =
      articles.find((article) => article.id === workspace.document.activeId) ||
      articles[0];
    redirect(
      article ? `/posts/${encodeURIComponent(article.id)}` : "/onboarding",
    );
  }
  return <SignInPage />;
}
