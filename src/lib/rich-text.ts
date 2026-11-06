import { z } from "zod";

export type RichNode = {
  type: string;
  text?: string;
  marks?: { type: string }[];
  content?: RichNode[];
  attrs?: { start?: number; language?: string | null };
};
const node: z.ZodType<RichNode> = z.lazy(() =>
  z.object({
    type: z.enum([
      "doc",
      "paragraph",
      "text",
      "bold",
      "bulletList",
      "orderedList",
      "listItem",
      "blockquote",
      "codeBlock",
      "hardBreak",
    ]),
    text: z.string().max(10000).optional(),
    marks: z
      .array(z.object({ type: z.enum(["bold", "italic", "strike", "code"]) }))
      .max(4)
      .optional(),
    attrs: z
      .object({
        start: z.number().int().min(1).max(10000).optional(),
        language: z.string().max(50).nullable().optional(),
      })
      .optional(),
    content: z.array(node).max(500).optional(),
  }),
);
export const richDocumentSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    let count = 0;
    function visit(n: unknown, depth: number): boolean {
      if (!n || typeof n !== "object" || depth > 12 || ++count > 2000)
        return false;
      const children = (n as RichNode).content;
      return (
        !children ||
        (Array.isArray(children) &&
          children.every((child) => visit(child, depth + 1)))
      );
    }
    if (!visit(value, 0))
      ctx.addIssue({ code: "custom", message: "This Note is too complex." });
  })
  .pipe(node)
  .refine((value) => value.type === "doc", "Expected a Note document.");

export function plainDocument(text: string): RichNode {
  return {
    type: "doc",
    content: text.split(/\n\n/).map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}
export function richTextToPlain(node: RichNode): string {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  const separator = [
    "doc",
    "bulletList",
    "orderedList",
    "listItem",
    "blockquote",
  ].includes(node.type)
    ? "\n\n"
    : "";
  return (node.content || []).map(richTextToPlain).join(separator);
}
export function hasRichFormatting(node: RichNode | undefined): boolean {
  return Boolean(
    node &&
      ((node.marks?.length || 0) > 0 ||
        !["doc", "paragraph", "text", "hardBreak"].includes(node.type) ||
        node.content?.some(hasRichFormatting)),
  );
}
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
export function richTextHtml(node: RichNode): string {
  if (node.type === "text")
    return (node.marks || []).reduce(
      (text, mark) => {
        const tag = { bold: "strong", italic: "em", strike: "s", code: "code" }[
          mark.type
        ];
        return tag ? `<${tag}>${text}</${tag}>` : text;
      },
      escapeHtml(node.text || "").replace(/\n/g, "<br>"),
    );
  if (node.type === "hardBreak") return "<br>";
  const content = (node.content || []).map(richTextHtml).join("");
  const tag = {
    paragraph: "p",
    bulletList: "ul",
    orderedList: "ol",
    listItem: "li",
    blockquote: "blockquote",
    codeBlock: "pre",
  }[node.type];
  return tag ? `<${tag}>${content}</${tag}>` : content;
}
