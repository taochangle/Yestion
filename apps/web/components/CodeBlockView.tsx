"use client";

import { useState } from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps
} from "@tiptap/react";
import { Check, ChevronDown, Copy } from "lucide-react";

const LANGUAGES = [
  { value: "plaintext", label: "Plain Text" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "rust", label: "Rust" },
  { value: "markdown", label: "Markdown" },
  { value: "yaml", label: "YAML" }
];

export default function CodeBlockView({
  node,
  updateAttributes
}: NodeViewProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const currentLanguage =
    (node.attrs.language as string | undefined) || "plaintext";

  function selectLanguage(value: string) {
    updateAttributes({ language: value });
    setOpen(false);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(node.textContent);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const currentLabel =
    LANGUAGES.find((language) => language.value === currentLanguage)?.label ??
    currentLanguage;

  return (
    <NodeViewWrapper className="relative">
      <div
        className={`absolute right-2 top-2 flex items-center gap-1 ${
          open ? "z-50" : "z-10"
        }`}
      >
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
        >
          {currentLabel}
          <ChevronDown size={13} />
        </button>
        <button
          type="button"
          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          aria-label="Copy code"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void copyCode()}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
        {open ? (
          <div className="absolute right-0 top-full mt-1 max-h-64 w-44 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            {LANGUAGES.map((language) => (
              <button
                key={language.value}
                type="button"
                className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800 ${
                  language.value === currentLanguage
                    ? "bg-zinc-100 font-medium dark:bg-zinc-800"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectLanguage(language.value)}
              >
                {language.label}
                {language.value === currentLanguage ? (
                  <Check size={13} />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <NodeViewContent className="block-code" />
    </NodeViewWrapper>
  );
}
