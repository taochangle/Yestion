"use client";

import { type JSONContent } from "@tiptap/react";
import {
  type ChangeEvent as ReactChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  Copy,
  CopyPlus,
  Download,
  FolderInput,
  History,
  Link,
  MoreHorizontal,
  PanelLeftOpen,
  Share2,
  Trash2,
  Upload
} from "lucide-react";
import BlockEditor from "@/components/BlockEditor";
import HistoryDialog from "@/components/HistoryDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { BlockNode, BreadcrumbItem } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  downloadTextFile,
  markdownToTiptap,
  normalizeLegacyMarkdownDocument,
  tiptapToMarkdown
} from "@/lib/markdown";

type PageEditorProps = {
  selectedBlock: BlockNode | null;
  breadcrumb: BreadcrumbItem[];
  onUpdateTitle: (blockId: string, title: string) => Promise<void>;
  onSaveContent: (blockId: string, document: JSONContent) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onUploadFile: (file: File) => Promise<string>;
  onOpenShare: () => void;
  onCopyLink: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onMoveToTrash: () => void;
  onMoveTo: () => void;
  sidebarCollapsed: boolean;
  onOpenSidebar: () => void;
};

export default function PageEditor({
  selectedBlock,
  breadcrumb,
  onUpdateTitle,
  onSaveContent,
  onUploadImage,
  onUploadFile,
  onOpenShare,
  onCopyLink,
  onDuplicate,
  onMoveToTrash,
  onMoveTo,
  sidebarCollapsed,
  onOpenSidebar
}: PageEditorProps) {
  const { t } = useI18n();
  const [draftTitle, setDraftTitle] = useState(
    selectedBlock?.properties.title ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [documentOverride, setDocumentOverride] = useState<JSONContent | null>(
    null
  );
  const [contentRevision, setContentRevision] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockIdRef = useRef(selectedBlock?.id ?? null);
  const saveContentRef = useRef(onSaveContent);
  const latestDocumentRef = useRef<JSONContent | null>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    blockIdRef.current = selectedBlock?.id ?? null;
    saveContentRef.current = onSaveContent;
  });

  const handleDocumentChange = useCallback((document: JSONContent) => {
    latestDocumentRef.current = document;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      const blockId = blockIdRef.current;
      if (blockId) {
        void saveContentRef.current(blockId, document);
      }
    }, 800);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handlePageShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        void onDuplicate();
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void onCopyLink();
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        onMoveTo();
      }
    }

    window.addEventListener("keydown", handlePageShortcut);
    return () => window.removeEventListener("keydown", handlePageShortcut);
  }, [onCopyLink, onDuplicate, onMoveTo]);

  if (!selectedBlock) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-10 text-zinc-400">
        {t("editor.selectPage")}
      </main>
    );
  }

  const currentBlock = selectedBlock;

  async function saveTitle() {
    const title = draftTitle.trim();
    if (!title || title === currentBlock.properties.title) {
      return;
    }

    setSaving(true);
    try {
      await onUpdateTitle(currentBlock.id, title);
    } finally {
      setSaving(false);
    }
  }

  function exportMarkdown() {
    const document =
      latestDocumentRef.current ??
      normalizeDocument(currentBlock.properties.content);
    if (!document) {
      return;
    }

    const filename = `${(currentBlock.properties.title || "untitled")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim() || "untitled"}.md`;
    downloadTextFile(filename, tiptapToMarkdown(document), "text/markdown");
  }

  async function copyPageContent() {
    const document =
      latestDocumentRef.current ??
      normalizeDocument(currentBlock.properties.content);
    const markdown = document ? tiptapToMarkdown(document) : "";
    await navigator.clipboard.writeText(markdown);
  }

  async function handleMarkdownImport(
    event: ReactChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const text = await file.text();
    const document = markdownToTiptap(text);
    latestDocumentRef.current = document;
    setDocumentOverride(document);
    setContentRevision((current) => current + 1);
    await onSaveContent(currentBlock.id, document);
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm leading-none text-zinc-500">
          {sidebarCollapsed && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mr-1 h-7 w-7 p-0"
              onClick={onOpenSidebar}
            >
              <PanelLeftOpen size={14} />
            </Button>
          )}
          {breadcrumb.map((item, index) => (
            <span key={item.id} className="flex items-center gap-1">
              {index > 0 && <span>/</span>}
              <span className={index === breadcrumb.length - 1 ? "text-zinc-900" : ""}>
                {item.title || t("editor.placeholder")}
              </span>
            </span>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <time className="mr-1 text-xs text-muted-foreground">
            {new Date(currentBlock.updatedAt).toLocaleString()}
          </time>
          <Button type="button" onClick={onOpenShare} variant="link" size="sm">
            <Share2 />
            {t("editor.share")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="link" size="sm">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void onCopyLink()}>
                <Link />
                {t("editor.copyLink")}
                <span className="ml-auto text-xs text-muted-foreground">⌘⇧C</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void copyPageContent()}>
                <Copy />
                {t("editor.copyContent")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void onDuplicate()}>
                <CopyPlus />
                {t("editor.duplicate")}
                <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMoveTo}>
                <FolderInput />
                {t("move.title")}
                <span className="ml-auto text-xs text-muted-foreground">⌘⇧M</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => markdownInputRef.current?.click()}>
                <Upload />
                {t("editor.importMd")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportMarkdown}>
                <Download />
                {t("editor.exportMd")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                <History />
                {t("editor.history")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onMoveToTrash}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 />
                {t("editor.trash")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <input
        value={draftTitle}
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        disabled={saving}
        className="w-full border-0 bg-transparent text-4xl font-semibold tracking-tight outline-none placeholder:text-zinc-300"
        placeholder={t("editor.placeholder")}
      />

      <input
        ref={markdownInputRef}
        type="file"
        accept=".md,text/markdown,text/plain"
        className="hidden"
        onChange={handleMarkdownImport}
      />

      <div className="mt-8 max-w-3xl">
        <BlockEditor
          key={`${currentBlock.id}-${contentRevision}`}
          blockId={currentBlock.id}
          breadcrumb={breadcrumb}
          initialDocument={
            documentOverride ??
            normalizeDocument(currentBlock.properties.content)
          }
          onDocumentChange={handleDocumentChange}
          onUploadImage={onUploadImage}
          onUploadFile={onUploadFile}
        />
      </div>

      {historyOpen && (
        <HistoryDialog
          blockId={currentBlock.id}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </main>
  );
}

function normalizeDocument(value: unknown): JSONContent | undefined {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type?: unknown }).type === "doc"
  ) {
    return normalizeLegacyMarkdownDocument(value as JSONContent);
  }

  return undefined;
}
