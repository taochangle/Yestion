import { type JSONContent } from "@tiptap/react";

function textContent(node: JSONContent | undefined): string {
  if (!node) {
    return "";
  }
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  return (node.content ?? []).map(textContent).join("");
}

function splitInlineMath(node: JSONContent): JSONContent[] {
  const text = node.text ?? "";
  const result: JSONContent[] = [];
  let lastIndex = 0;
  const pattern = /\\\((.*?)\\\)/g;

  for (const match of text.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      result.push({ ...node, text: text.slice(lastIndex, matchIndex) });
    }
    result.push({
      type: "inlineMath",
      attrs: { expression: match[1] }
    });
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ ...node, text: text.slice(lastIndex) });
  }

  return result.length > 0 ? result : [node];
}

function normalizeInlineContent(content: JSONContent[] | undefined): JSONContent[] {
  if (!content) {
    return [];
  }

  return content.flatMap((node) => {
    if (node.type === "text") {
      return splitInlineMath(node);
    }
    if (node.content) {
      return [
        {
          ...node,
          content: normalizeInlineContent(node.content)
        }
      ];
    }
    return [node];
  });
}

export function normalizeRichDocument(document: JSONContent): JSONContent {
  const source = document.content ?? [];
  const result: JSONContent[] = [];
  let index = 0;

  while (index < source.length) {
    const node = source[index];

    if (
      node.type === "paragraph" &&
      textContent(node).trim() === "$$"
    ) {
      const lines: string[] = [];
      index += 1;
      while (
        index < source.length &&
        !(
          source[index].type === "paragraph" &&
          textContent(source[index]).trim() === "$$"
        )
      ) {
        lines.push(textContent(source[index]));
        index += 1;
      }

      if (index < source.length) {
        result.push({
          type: "mathBlock",
          attrs: { expression: lines.join("\n").trim() }
        });
        index += 1;
        continue;
      }
    }

    if (
      node.type === "codeBlock" &&
      node.attrs &&
      node.attrs.language === "mermaid"
    ) {
      result.push({
        type: "mermaidBlock",
        attrs: { code: textContent(node) }
      });
      index += 1;
      continue;
    }

    result.push({
      ...node,
      content: normalizeInlineContent(node.content)
    });
    index += 1;
  }

  return { type: "doc", content: result };
}
