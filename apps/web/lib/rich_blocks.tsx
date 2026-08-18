"use client";

import { Node } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps
} from "@tiptap/react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  Code2,
  Download,
  Eye,
  Maximize2,
  Minimize2,
  Pencil,
  Rows2,
  Save
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useEffect, useId, useMemo, useState } from "react";

function MathBlockView({
  node,
  updateAttributes
}: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(node.attrs.expression ?? ""));

  const html = useMemo(
    () =>
      katex.renderToString(value || String(node.attrs.expression ?? ""), {
        displayMode: true,
        throwOnError: false
      }),
    [node.attrs.expression, value]
  );

  function save() {
    updateAttributes({ expression: value.trim() });
    setEditing(false);
  }

  if (editing) {
    return (
      <NodeViewWrapper className="block-math block-math-editing">
        <textarea
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              save();
            }
            if (event.key === "Escape") {
              setValue(String(node.attrs.expression ?? ""));
              setEditing(false);
            }
          }}
          rows={Math.max(2, value.split("\n").length)}
          className="w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 font-mono text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setValue(String(node.attrs.expression ?? ""));
              setEditing(false);
            }}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            onMouseDown={(event) => event.preventDefault()}
            onClick={save}
          >
            保存
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="block-math group relative">
      <div
        className="cursor-pointer"
        onClick={() => setEditing(true)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <button
        type="button"
        className="absolute right-2 top-2 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 group-hover:flex dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        aria-label="Edit formula"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setEditing(true)}
      >
        <Pencil size={13} />
      </button>
    </NodeViewWrapper>
  );
}

function InlineMathView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(node.attrs.expression ?? ""));
  const html = useMemo(
    () =>
      katex.renderToString(String(node.attrs.expression ?? ""), {
        displayMode: false,
        throwOnError: false
      }),
    [node.attrs.expression]
  );

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="inline-math inline-math-editing">
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            updateAttributes({ expression: value.trim() });
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              updateAttributes({ expression: value.trim() });
              setEditing(false);
            }
            if (event.key === "Escape") {
              setValue(String(node.attrs.expression ?? ""));
              setEditing(false);
            }
          }}
          className="w-28 rounded border border-zinc-200 bg-white px-1 py-0.5 font-mono text-xs text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className="inline-math cursor-pointer"
      onClick={() => setEditing(true)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

type MermaidMode = "preview" | "source" | "split";

function MermaidBlockView({
  node,
  updateAttributes
}: NodeViewProps) {
  const [mode, setMode] = useState<MermaidMode>("preview");
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [value, setValue] = useState(String(node.attrs.code ?? ""));
  const [svg, setSvg] = useState("");
  const reactId = useId();
  const mermaidId = `mermaid-${reactId.replace(/:/g, "")}`;

  useEffect(() => {
    let cancelled = false;

    import("mermaid")
      .then((module) => {
        module.default.initialize({
          startOnLoad: false,
          securityLevel: "loose"
        });
        return module.default.render(mermaidId, value);
      })
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSvg(`<pre>${value}</pre>`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mermaidId, value]);

  function save() {
    updateAttributes({ code: value });
  }

  function downloadSvg() {
    if (!svg) {
      return;
    }
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mermaid.svg";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <NodeViewWrapper className="block-mermaid group relative rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <TooltipProvider delayDuration={200}>
        <div className="absolute right-2 top-2 z-10 flex items-center divide-x divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 cursor-pointer items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setMode("source")}
              >
                <Code2 size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>源码</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 cursor-pointer items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setPreviewOpen(true)}
              >
                <Eye size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>打开预览</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 cursor-pointer items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setMode("split")}
              >
                <Rows2 size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>上下分屏</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 cursor-pointer items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={downloadSvg}
              >
                <Download size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>下载 SVG</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 cursor-pointer items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{expanded ? "收起" : "展开"}</TooltipContent>
          </Tooltip>
          {mode !== "preview" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={save}
                >
                  <Save size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>保存</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </TooltipProvider>

      <div
        className={`w-full ${
          expanded
            ? "min-h-[460px]"
            : mode === "source"
              ? "min-h-[220px]"
              : "min-h-[300px]"
        } pt-8`}
      >
        {mode === "source" ? (
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-full min-h-[180px] w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 font-mono text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        ) : mode === "split" ? (
          <div className="flex min-h-[300px] flex-col gap-3">
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="min-h-[140px] w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 font-mono text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <div
              className="min-h-[160px] flex-1 overflow-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        ) : (
          <div
            className="flex min-h-[260px] items-center justify-center overflow-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-auto">
          <DialogHeader>
            <DialogTitle>预览</DialogTitle>
          </DialogHeader>
          <div
            className="flex items-center justify-center overflow-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </DialogContent>
      </Dialog>
    </NodeViewWrapper>
  );
}

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  inline: false,
  markdownTokenName: "mathBlock",

  addAttributes() {
    return {
      expression: {
        default: ""
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='math-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-type": "math-block", ...HTMLAttributes }];
  },

  markdownTokenizer: {
    name: "mathBlock",
    level: "block",
    start: (src) => src.indexOf("$$"),
    tokenize: (src) => {
      const match = /^\$\$([\s\S]*?)\$\$/.exec(src);
      if (!match) {
        return undefined;
      }
      return {
        type: "mathBlock",
        raw: match[0],
        expression: match[1].trim()
      };
    }
  },

  parseMarkdown: (token) => ({
    type: "mathBlock",
    attrs: { expression: token.expression }
  }),

  renderMarkdown: (node) => `$$\n${node.attrs?.expression ?? ""}\n$$`,

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  }
});

export const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  markdownTokenName: "inlineMath",

  addAttributes() {
    return {
      expression: {
        default: ""
      }
    };
  },

  parseHTML() {
    return [{ tag: "span[data-type='inline-math']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", { "data-type": "inline-math", ...HTMLAttributes }];
  },

  markdownTokenizer: {
    name: "inlineMath",
    level: "inline",
    start: (src) => src.indexOf("$"),
    tokenize: (src) => {
      const match = /^\$([^$\n]+?)\$/.exec(src);
      if (!match) {
        return undefined;
      }
      return {
        type: "inlineMath",
        raw: match[0],
        expression: match[1].trim()
      };
    }
  },

  parseMarkdown: (token) => ({
    type: "inlineMath",
    attrs: { expression: token.expression }
  }),

  renderMarkdown: (node) => `$${node.attrs?.expression ?? ""}$`,

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView);
  }
});

export const MermaidBlock = Node.create({
  name: "mermaidBlock",
  group: "block",
  atom: true,
  inline: false,

  addAttributes() {
    return {
      code: {
        default: ""
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='mermaid-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-type": "mermaid-block", ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView);
  }
});
