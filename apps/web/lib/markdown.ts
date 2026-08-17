import { type JSONContent } from "@tiptap/react";

export function tiptapToMarkdown(document: JSONContent): string {
  return (
    (document.content ?? [])
      .map((node) => nodeToMarkdown(node, 0))
      .join("")
      .trimEnd() + "\n"
  );
}

export function markdownToTiptap(markdown: string): JSONContent {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const content: JSONContent[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      content.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim().split(/\s+/)[0] || undefined;
      const codeLines: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        !lines[index].trim().startsWith("```")
      ) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      content.push({
        type: "codeBlock",
        attrs: language ? { language } : undefined,
        content: [{ type: "text", text: codeLines.join("\n") }]
      });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: parseInline(heading[2])
      });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = parseTable(lines, index);
      content.push(table.node);
      index = table.nextIndex;
      continue;
    }

    if (isListLine(line)) {
      const list = parseList(lines, index, leadingSpaces(line));
      content.push(list.node);
      index = list.nextIndex;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (
        index < lines.length &&
        (lines[index].startsWith(">") || lines[index].trim() === "")
      ) {
        if (lines[index].trim() === "") {
          quoteLines.push("");
        } else {
          quoteLines.push(lines[index].replace(/^>\s?/, ""));
        }
        index += 1;
      }
      content.push({
        type: "blockquote",
        content: markdownToTiptap(quoteLines.join("\n")).content
      });
      continue;
    }

    content.push({
      type: "paragraph",
      content: parseInline(line)
    });
    index += 1;
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

export function downloadTextFile(
  filename: string,
  content: string,
  type = "text/plain"
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function normalizeLegacyMarkdownDocument(
  document: JSONContent
): JSONContent {
  return normalizeMarkdownNode(document);
}

function normalizeMarkdownNode(node: JSONContent): JSONContent {
  if (!node.content) {
    return node;
  }

  const convertedContent = convertLegacyTables(node.content);
  return {
    ...node,
    content: convertedContent.flatMap(normalizeMarkdownNodeContent)
  };
}

function normalizeMarkdownNodeContent(node: JSONContent): JSONContent[] {
  if (node.type === "codeBlock") {
    return [node];
  }

  if (node.type === "text" && !node.marks?.length && node.text) {
    return parseInline(node.text);
  }

  if (!node.content) {
    return [node];
  }

  return [
    {
      ...node,
      content: node.content.flatMap(normalizeMarkdownNodeContent)
    }
  ];
}

function convertLegacyTables(content: JSONContent[]): JSONContent[] {
  const result: JSONContent[] = [];
  let index = 0;

  while (index < content.length) {
    if (isLegacyTableStart(content, index)) {
      const tableLines: string[] = [];
      while (
        index < content.length &&
        isParagraphWithPipes(content[index])
      ) {
        tableLines.push(plainText(content[index]));
        index += 1;
      }

      const parsed = markdownToTiptap(tableLines.join("\n"));
      result.push(...(parsed.content ?? []));
      continue;
    }

    result.push(content[index]);
    index += 1;
  }

  return result;
}

function isLegacyTableStart(
  content: JSONContent[],
  index: number
): boolean {
  const first = content[index];
  const second = content[index + 1];
  if (!isParagraphWithPipes(first) || !second) {
    return false;
  }

  const separator = plainText(second);
  return (
    /^\s*\|?[\s:|-]+\|?\s*$/.test(separator) &&
    separator.includes("-")
  );
}

function isParagraphWithPipes(node?: JSONContent): boolean {
  return node?.type === "paragraph" && plainText(node).includes("|");
}

function plainText(node: JSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }
  return (node.content ?? []).map(plainText).join("");
}

function nodeToMarkdown(node: JSONContent, level: number): string {
  switch (node.type) {
    case "paragraph":
      return inlineToMarkdown(node.content ?? []) + "\n\n";
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${inlineToMarkdown(
        node.content ?? []
      )}\n\n`;
    case "bulletList":
    case "orderedList":
    case "taskList":
      return listToMarkdown(node, level) + "\n";
    case "blockquote":
      return blockquoteToMarkdown(node, level) + "\n";
    case "codeBlock":
      return `\`\`\`\n${inlineToMarkdown(node.content ?? [])}\n\`\`\`\n\n`;
    case "image":
      return `![${node.attrs?.alt ?? ""}](${node.attrs?.src ?? ""})\n\n`;
    case "horizontalRule":
      return "---\n\n";
    case "table":
      return tableToMarkdown(node) + "\n";
    case "details":
      return detailsToMarkdown(node, level) + "\n";
    default:
      return inlineToMarkdown(node.content ?? []) + "\n\n";
  }
}

function listToMarkdown(node: JSONContent, level: number): string {
  const prefix = "  ".repeat(level);
  const isOrdered = node.type === "orderedList";
  const isTask = node.type === "taskList";

  return (node.content ?? [])
    .map((item, index) => {
      const content = listItemToMarkdown(item, level + 1);
      if (isTask) {
        const checked = Boolean(item.attrs?.checked);
        return `${prefix}- [${checked ? "x" : " "}] ${content.trimStart()}`;
      }
      if (isOrdered) {
        return `${prefix}${index + 1}. ${content.trimStart()}`;
      }
      return `${prefix}- ${content.trimStart()}`;
    })
    .join("\n");
}

function listItemToMarkdown(node: JSONContent, level: number): string {
  const direct = (node.content ?? []).filter(
    (child) => !["bulletList", "orderedList", "taskList"].includes(child.type ?? "")
  );
  const nested = (node.content ?? []).filter((child) =>
    ["bulletList", "orderedList", "taskList"].includes(child.type ?? "")
  );

  const text = direct.map((child) => inlineToMarkdown(child.content ?? [])).join(" ");
  const nestedText = nested
    .map((child) => listToMarkdown(child, level))
    .join("\n");

  return `${text}${nestedText ? `\n${nestedText}` : ""}`;
}

function blockquoteToMarkdown(node: JSONContent, level: number): string {
  const inner = (node.content ?? [])
    .map((child) => nodeToMarkdown(child, level + 1))
    .join("")
    .trimEnd();
  const prefix = "> ";
  return inner
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function tableToMarkdown(node: JSONContent): string {
  const rows = node.content ?? [];
  if (rows.length === 0) {
    return "";
  }

  const headers = (rows[0]?.content ?? []).map((cell) =>
    inlineToMarkdown(cell.content ?? []).trim()
  );
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.slice(1).map(
    (row) =>
      `| ${(row.content ?? [])
        .map((cell) => inlineToMarkdown(cell.content ?? []).trim())
        .join(" | ")} |`
  );

  return [headerLine, separatorLine, ...bodyLines].join("\n");
}

function detailsToMarkdown(node: JSONContent, level: number): string {
  const summary = (node.content ?? []).find(
    (child) => child.type === "detailsSummary"
  );
  const content = (node.content ?? []).find(
    (child) => child.type === "detailsContent"
  );
  const summaryText = inlineToMarkdown(summary?.content ?? []);
  const contentText = (content?.content ?? [])
    .map((child) => nodeToMarkdown(child, level))
    .join("");
  return `> **${summaryText}**\n> ${contentText.replace(/\n/g, "\n> ")}`;
}

function inlineToMarkdown(nodes: JSONContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return wrapTextWithMarks(node.text ?? "", node.marks ?? []);
      }
      if (node.type === "hardBreak") {
        return "\n";
      }
      if (node.type === "image") {
        return `![${node.attrs?.alt ?? ""}](${node.attrs?.src ?? ""})`;
      }
      return inlineToMarkdown(node.content ?? []);
    })
    .join("");
}

function wrapTextWithMarks(
  text: string,
  marks: Array<{ type: string; attrs?: Record<string, unknown> }>
): string {
  let output = text;

  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        output = `**${output}**`;
        break;
      case "italic":
        output = `*${output}*`;
        break;
      case "strike":
        output = `~~${output}~~`;
        break;
      case "code":
        output = `\`${output}\``;
        break;
      case "underline":
        output = `<u>${output}</u>`;
        break;
      case "link":
        output = `[${output}](${mark.attrs?.href ?? ""})`;
        break;
      default:
        break;
    }
  }

  return output;
}

function parseInline(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...parseFormatting(text.slice(lastIndex, match.index)));
    }

    if (match[0].startsWith("!")) {
      nodes.push({
        type: "image",
        attrs: {
          src: match[2],
          alt: match[1]
        }
      });
    } else {
      nodes.push(
        ...withMark(
          parseFormatting(match[3]),
          "link",
          { href: match[4] }
        )
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(...parseFormatting(text.slice(lastIndex)));
  }

  return nodes;
}

function parseFormatting(text: string): JSONContent[] {
  if (text === "") {
    return [];
  }

  const nodes: JSONContent[] = [];
  const regex =
    /(\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|<u>([^<]+)<\/u>)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[7] !== undefined) {
      nodes.push({
        type: "text",
        text: match[7],
        marks: [{ type: "code" }]
      });
    } else if (match[8] !== undefined) {
      nodes.push({
        type: "text",
        text: match[8],
        marks: [{ type: "underline" }]
      });
    } else if (match[2] !== undefined || match[3] !== undefined) {
      nodes.push({
        type: "text",
        text: match[2] ?? match[3],
        marks: [{ type: "bold" }]
      });
    } else if (match[4] !== undefined) {
      nodes.push({
        type: "text",
        text: match[4],
        marks: [{ type: "strike" }]
      });
    } else {
      nodes.push({
        type: "text",
        text: match[5] ?? match[6],
        marks: [{ type: "italic" }]
      });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes;
}

function withMark(
  nodes: JSONContent[],
  type: string,
  attrs: Record<string, unknown>
): JSONContent[] {
  return nodes.map((node) => {
    if (node.type !== "text") {
      return node;
    }
    return {
      ...node,
      marks: [...(node.marks ?? []), { type, attrs }]
    };
  });
}

function isHorizontalRule(line: string): boolean {
  return /^\s*(\*{3,}|-{3,}|_{3,})\s*$/.test(line);
}

function isListLine(line: string): boolean {
  return (
    /^\s*[-*]\s+/.test(line) ||
    /^\s*[-*]\s+\[[ xX]\]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line)
  );
}

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length;
}

function parseList(
  lines: string[],
  index: number,
  indent: number
): { node: JSONContent; nextIndex: number } {
  const type = detectListType(lines[index]);
  const items: JSONContent[] = [];

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      break;
    }
    const lineIndent = leadingSpaces(line);
    if (lineIndent < indent || !isListLine(line)) {
      break;
    }

    if (lineIndent > indent) {
      const nested = parseList(lines, index, lineIndent);
      if (items.length > 0) {
        items[items.length - 1].content?.push(nested.node);
      }
      index = nested.nextIndex;
      continue;
    }

    const item = parseListItem(line);
    items.push(item);
    index += 1;

    if (
      index < lines.length &&
      lines[index].trim() !== "" &&
      leadingSpaces(lines[index]) > indent &&
      isListLine(lines[index])
    ) {
      const nested = parseList(lines, index, leadingSpaces(lines[index]));
      item.content?.push(nested.node);
      index = nested.nextIndex;
    }
  }

  return {
    node: { type, content: items },
    nextIndex: index
  };
}

function detectListType(line: string): string {
  if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) {
    return "taskList";
  }
  if (/^\s*\d+\.\s+/.test(line)) {
    return "orderedList";
  }
  return "bulletList";
}

function parseListItem(line: string): JSONContent {
  const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
  if (task) {
    return {
      type: "taskItem",
      attrs: { checked: task[1].toLowerCase() === "x" },
      content: [{ type: "paragraph", content: parseInline(task[2]) }]
    };
  }

  const unordered = line.match(/^\s*[-*]\s+(.*)$/);
  if (unordered) {
    return {
      type: "listItem",
      content: [
        { type: "paragraph", content: parseInline(unordered[1]) }
      ]
    };
  }

  const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
  return {
    type: "listItem",
    content: [
      { type: "paragraph", content: parseInline(ordered?.[1] ?? "") }
    ]
  };
}

function isTableStart(lines: string[], index: number): boolean {
  const first = lines[index];
  const second = lines[index + 1];
  return Boolean(
    first?.includes("|") &&
      second &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(second) &&
      second.includes("-")
  );
}

function parseTable(
  lines: string[],
  index: number
): { node: JSONContent; nextIndex: number } {
  const headerCells = splitTableRow(lines[index]);
  const rows: JSONContent[] = [
    {
      type: "tableRow",
      content: headerCells.map((cell) => ({
        type: "tableHeader",
        content: [
          {
            type: "paragraph",
            content: parseInline(cell.trim())
          }
        ]
      }))
    }
  ];

  index += 2;
  while (index < lines.length && lines[index].includes("|")) {
    rows.push({
      type: "tableRow",
      content: splitTableRow(lines[index]).map((cell) => ({
        type: "tableCell",
        content: [
          {
            type: "paragraph",
            content: parseInline(cell.trim())
          }
        ]
      }))
    });
    index += 1;
  }

  return {
    node: { type: "table", content: rows },
    nextIndex: index
  };
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}
