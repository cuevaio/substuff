export const onboardingSteps = [
  { id: "content", label: "Getting your beautiful content" },
  { id: "understanding", label: "Understanding your ideas" },
  { id: "style", label: "Figuring out your style" },
  { id: "writing", label: "Writing some suggested Notes" },
] as const;
export type OnboardingStep = (typeof onboardingSteps)[number]["id"];

export function hasSubstackChannel(
  channels: { isDisconnected: boolean; isLocked: boolean }[] | undefined,
) {
  return Boolean(
    channels?.some((channel) => !channel.isDisconnected && !channel.isLocked),
  );
}

export function hasWriting(articles: { mode: string; sourceUrl?: string }[]) {
  return articles.some(
    (article) => article.mode !== "sample" && Boolean(article.sourceUrl),
  );
}
