import { notFound } from "next/navigation";
import { PostEditor } from "@/components/post-editor";
import { readAccountSession } from "@/lib/account-session";

export default async function Page({ params }: PageProps<"/posts/[id]">) {
  const { id } = await params;
  const workspace = await readAccountSession();
  if (
    !workspace?.document.articles.some(
      (article) => article.id === id && article.mode !== "sample",
    )
  )
    notFound();
  return <PostEditor key={id} articleId={id} />;
}
