import { z } from "zod";
import { parseSubstackUrl } from "./substack-url";

export const articleInput = z.object({
  title: z.string().trim().min(1, "Add a title.").max(180),
  content: z
    .string()
    .trim()
    .min(200, "Add at least 200 characters so there’s something to work with.")
    .max(
      60000,
      "This article is too long. Try a section under 60,000 characters.",
    ),
});

export const generatedNotes = z.object({
  notes: z
    .array(
      z.object({
        angle: z.enum([
          "An idea",
          "A useful example",
          "A different perspective",
          "A question",
          "An invitation",
        ]),
        text: z.string().trim().min(20).max(1800),
        source: z.string().trim().min(20).max(3000),
      }),
    )
    .min(1)
    .max(5),
});

export type Note = {
  id: string;
  angle: string;
  text: string;
  original: string;
  source: string;
  approved: boolean;
};

export type Article = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  mode: "sample" | "excerpts" | "ai";
  sourceUrl?: string;
  notes: Note[];
};

export const workspaceSchema = z.object({
  version: z.literal(1),
  activeId: z.string(),
  articles: z
    .array(
      z.object({
        id: z.string().max(100),
        title: z.string().max(180),
        content: z.string().max(60000),
        createdAt: z.string().max(40),
        mode: z.enum(["sample", "excerpts", "ai"]),
        sourceUrl: z
          .string()
          .max(2048)
          .refine((value) => {
            try {
              return parseSubstackUrl(value).url === value;
            } catch {
              return false;
            }
          })
          .optional(),
        notes: z
          .array(
            z.object({
              id: z.string().max(100),
              angle: z.string().max(100),
              text: z.string().max(60000),
              original: z.string().max(60000),
              source: z.string().max(60000),
              approved: z.boolean(),
            }),
          )
          .max(10),
      }),
    )
    .max(100),
});

export function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function isGrounded(source: string, article: string) {
  return normalize(article).includes(normalize(source));
}

// A credential-free editing starting point, not AI-generated writing.
export function extractNotes(content: string): Note[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 60);
  const candidates = paragraphs.length ? paragraphs : [content.trim()];
  const seen = new Set<string>();
  return candidates
    .filter((p) => {
      if (seen.has(normalize(p))) return false;
      seen.add(normalize(p));
      return true;
    })
    .slice(0, 4)
    .map((paragraph, index) => {
      const sentences = paragraph.match(
        /[^.!?]+[.!?]+(?:[”’"']|$)?|[^.!?]+$/g,
      ) ?? [paragraph];
      let text = "";
      for (const sentence of sentences) {
        if ((text + sentence).length > 1200) break;
        text += sentence;
      }
      // Never cut a sentence off and present it as a complete thought.
      text = text.trim() || paragraph;
      return {
        id: `excerpt-${index}`,
        angle: "From your article",
        text,
        original: text,
        source: paragraph,
        approved: false,
      };
    });
}

export function exportNotes(article: Article, approvedOnly = true) {
  const notes = approvedOnly
    ? article.notes.filter((n) => n.approved)
    : article.notes;
  return `${article.title}\n\n${notes.map((n) => n.text).join("\n\n———\n\n")}\n`;
}

export const sampleArticle: Article = {
  id: "sample-a-little-less",
  title: "A little less, a little better",
  createdAt: "2026-11-06T09:00:00.000Z",
  mode: "sample",
  content: `For a long time, I treated a full calendar as evidence of a good week. If every hour had somewhere to go, surely I was going somewhere too. What I couldn’t see was that I had filled the space where the interesting work used to happen.

Last month, I tried a smaller experiment. I stopped writing a new to-do list each morning and chose one thing worth finishing instead. Not the most urgent thing. The thing I would still be glad I’d done on Friday. The rest of the list stayed where it was.

It didn’t make me dramatically more productive. Some days were still messy. But I noticed that I was returning to the same problem long enough to understand it. There’s a kind of progress that only happens when you stop changing the subject.

We talk about consistency as if it means doing more, more often. I’m beginning to think it means making fewer promises and keeping them. A small practice you can return to is more useful than an ambitious routine you keep restarting.

I haven’t figured out the perfect week. I’m not sure that’s the point. But I’ve started leaving a little room in mine, and the work is better for it. What would you make space for if your calendar didn’t have to prove anything?`,
  notes: [
    {
      id: "sample-1",
      angle: "An idea",
      approved: false,
      text: "A full calendar can look like progress.\n\nFor a long time, I filled every hour and called it a good week. What I couldn’t see was that I’d filled the space where the interesting work used to happen.",
      original:
        "A full calendar can look like progress.\n\nFor a long time, I filled every hour and called it a good week. What I couldn’t see was that I’d filled the space where the interesting work used to happen.",
      source:
        "For a long time, I treated a full calendar as evidence of a good week. If every hour had somewhere to go, surely I was going somewhere too. What I couldn’t see was that I had filled the space where the interesting work used to happen.",
    },
    {
      id: "sample-2",
      angle: "A useful example",
      approved: false,
      text: "A small experiment: instead of writing a new to-do list each morning, choose one thing worth finishing.\n\nNot the most urgent thing. The thing you’ll still be glad you did on Friday.",
      original:
        "A small experiment: instead of writing a new to-do list each morning, choose one thing worth finishing.\n\nNot the most urgent thing. The thing you’ll still be glad you did on Friday.",
      source:
        "Last month, I tried a smaller experiment. I stopped writing a new to-do list each morning and chose one thing worth finishing instead. Not the most urgent thing. The thing I would still be glad I’d done on Friday. The rest of the list stayed where it was.",
    },
    {
      id: "sample-3",
      angle: "A different perspective",
      approved: false,
      text: "Maybe consistency isn’t doing more, more often.\n\nMaybe it’s making fewer promises and keeping them. A small practice you can return to is more useful than an ambitious routine you keep restarting.",
      original:
        "Maybe consistency isn’t doing more, more often.\n\nMaybe it’s making fewer promises and keeping them. A small practice you can return to is more useful than an ambitious routine you keep restarting.",
      source:
        "We talk about consistency as if it means doing more, more often. I’m beginning to think it means making fewer promises and keeping them. A small practice you can return to is more useful than an ambitious routine you keep restarting.",
    },
    {
      id: "sample-4",
      angle: "A question",
      approved: false,
      text: "What would you make space for if your calendar didn’t have to prove anything?",
      original:
        "What would you make space for if your calendar didn’t have to prove anything?",
      source:
        "I haven’t figured out the perfect week. I’m not sure that’s the point. But I’ve started leaving a little room in mine, and the work is better for it. What would you make space for if your calendar didn’t have to prove anything?",
    },
  ],
};
