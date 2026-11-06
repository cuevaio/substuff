"use client";
import { useRouter } from "next/navigation";
import { Onboarding } from "@/components/onboarding";
import { useWorkspace } from "@/components/workspace-provider";

export function OnboardingPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  return (
    <Onboarding
      beforeStart={workspace.flush}
      onReady={(document, revision) => {
        workspace.applyServer(document, revision);
        const article = document.articles.find(
          (article) => article.mode !== "sample",
        );
        if (article) router.replace(`/posts/${encodeURIComponent(article.id)}`);
      }}
    />
  );
}
