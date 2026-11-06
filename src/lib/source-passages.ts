import { z } from "zod";
import { generatedNotes, normalize } from "./content";

export function sourcePassages(content: string) {
  const passages: { id: number; text: string }[] = [];
  for (const paragraph of content.split(/\n\s*\n/).map((text) => text.trim())) {
    for (let offset = 0; offset < paragraph.length; offset += 2500) {
      const text = paragraph.slice(offset, offset + 2500);
      if (text.length >= 20) passages.push({ id: passages.length, text });
    }
  }
  return passages;
}

export const referencedDrafts = z.object({
  notes: z
    .array(
      z.object({
        angle: generatedNotes.shape.notes.element.shape.angle,
        text: generatedNotes.shape.notes.element.shape.text,
        sourceId: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(5),
});

export function resolveSources(
  output: unknown,
  passages: ReturnType<typeof sourcePassages>,
) {
  const parsed = referencedDrafts.parse(output);
  const seen = new Set<string>();
  return generatedNotes.parse({
    notes: parsed.notes
      .map((note) => {
        const passage = passages[note.sourceId];
        if (!passage || passage.id !== note.sourceId)
          throw new Error("Ungrounded source");
        return { angle: note.angle, text: note.text, source: passage.text };
      })
      .filter((note) => {
        const key = normalize(note.text).toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
  });
}
