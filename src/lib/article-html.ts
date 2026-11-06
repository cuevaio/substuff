import sanitize from "sanitize-html";

export function sanitizeArticleHtml(html: string) {
  return sanitize(html, {
    allowedTags: [
      "p",
      "br",
      "h1",
      "h2",
      "h3",
      "h4",
      "strong",
      "b",
      "em",
      "i",
      "s",
      "del",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "figure",
      "figcaption",
      "img",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      ol: ["start"],
    },
    allowedSchemes: ["https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitize.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      img: sanitize.simpleTransform("img", { loading: "lazy" }),
    },
    nonTextTags: ["script", "style", "textarea", "noscript", "iframe"],
  });
}
