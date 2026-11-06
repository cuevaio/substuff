export function sourceRanges(
  chunks: { text: string; block: string | number }[],
  source: string,
) {
  const chars: string[] = [];
  const positions: { node: number; offset: number }[] = [];
  const space = (node: number, offset: number) => {
    if (chars.length && chars[chars.length - 1] !== " ") {
      chars.push(" ");
      positions.push({ node, offset });
    }
  };
  chunks.forEach((chunk, index) => {
    if (index && chunks[index - 1].block !== chunk.block) space(-1, 0);
    for (let offset = 0; offset < chunk.text.length; offset++) {
      const char = chunk.text[offset];
      if (/\s/.test(char)) space(index, offset);
      else {
        chars.push(char);
        positions.push({ node: index, offset });
      }
    }
  });
  const needle = source.replace(/\s+/g, " ").trim();
  if (!needle) return [];
  const start = chars.join("").indexOf(needle);
  if (start < 0) return [];
  const ranges = new Map<
    number,
    { node: number; start: number; end: number }
  >();
  for (const point of positions.slice(start, start + needle.length))
    if (point.node >= 0) {
      const range = ranges.get(point.node);
      if (range) range.end = point.offset + 1;
      else
        ranges.set(point.node, {
          node: point.node,
          start: point.offset,
          end: point.offset + 1,
        });
    }
  return [...ranges.values()];
}

export function highlightSource(root: HTMLElement, source: string) {
  for (const mark of root.querySelectorAll("mark[data-source-highlight]"))
    mark.replaceWith(...mark.childNodes);
  root.normalize();
  const nodes: Text[] = [];
  const blocks = new Map<Element, number>();
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    nodes.push(node as Text);
  const ranges = sourceRanges(
    nodes.map((node) => {
      const block =
        node.parentElement?.closest("p,li,h1,h2,h3,h4,pre,figcaption") || root;
      if (!blocks.has(block)) blocks.set(block, blocks.size);
      return { text: node.data, block: blocks.get(block) || 0 };
    }),
    source,
  );
  for (const range of ranges) {
    const original = nodes[range.node];
    const middle = original.splitText(range.start);
    middle.splitText(range.end - range.start);
    const mark = root.ownerDocument.createElement("mark");
    mark.dataset.sourceHighlight = "true";
    middle.replaceWith(mark);
    mark.appendChild(middle);
  }
  return ranges.length > 0;
}

export function scrollToSource(container: HTMLElement) {
  const mark = container.querySelector("mark[data-source-highlight]");
  if (!mark) return;
  const noMotion =
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.input === "keyboard";
  container.scrollTo({
    top:
      container.scrollTop +
      mark.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      container.clientHeight / 3,
    behavior: noMotion ? "instant" : "smooth",
  });
}
