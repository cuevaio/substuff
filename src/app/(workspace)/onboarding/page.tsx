import { redirect } from "next/navigation";
import { OnboardingPage } from "@/components/onboarding-page";
import { readAccountSession } from "@/lib/account-session";

export default async function Page() {
  const workspace = await readAccountSession();
  const article = workspace?.document.articles.find(
    (article) => article.mode !== "sample",
  );
  if (article) redirect(`/posts/${encodeURIComponent(article.id)}`);
  return <OnboardingPage />;
}
