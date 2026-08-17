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
  Image as ImageIcon,
  Link,
  MoreHorizontal,
  PanelLeftOpen,
  Share2,
  SmilePlus,
  Star,
  Trash2,
  Upload
} from "lucide-react";
import BlockEditor from "@/components/BlockEditor";
import HistoryDialog from "@/components/HistoryDialog";
import PageCoverDialog, {
  UNSPLASH_COVERS
} from "@/components/PageCoverDialog";
import PageIconDialog from "@/components/PageIconDialog";
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
import { formatRelativeTime } from "@/lib/time";

type PageEditorProps = {
  selectedBlock: BlockNode | null;
  breadcrumb: BreadcrumbItem[];
  onUpdateTitle: (blockId: string, title: string) => Promise<void>;
  onUpdateProperties: (
    blockId: string,
    properties: Record<string, unknown>
  ) => Promise<void>;
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
  onUpdateProperties,
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
  const { locale, t } = useI18n();
  const [draftTitle, setDraftTitle] = useState(
    selectedBlock?.properties.title ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [documentOverride, setDocumentOverride] = useState<JSONContent | null>(
    null
  );
  const [contentRevision, setContentRevision] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [savingProperties, setSavingProperties] = useState(false);
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
  const cover =
    typeof currentBlock.properties.cover === "string"
      ? currentBlock.properties.cover
      : "";
  const icon =
    typeof currentBlock.properties.icon === "string"
      ? currentBlock.properties.icon
      : "";
  const favorite = currentBlock.properties.favorite === true;

  async function toggleFavorite() {
    setSavingProperties(true);
    try {
      await onUpdateProperties(currentBlock.id, { favorite: !favorite });
    } finally {
      setSavingProperties(false);
    }
  }

  async function updateCover(nextCover: string) {
    setSavingProperties(true);
    try {
      await onUpdateProperties(currentBlock.id, { cover: nextCover });
      setCoverOpen(false);
    } finally {
      setSavingProperties(false);
    }
  }

  async function addRandomCover() {
    const nextCover =
      UNSPLASH_COVERS[Math.floor(Math.random() * UNSPLASH_COVERS.length)].url;
    setSavingProperties(true);
    try {
      await onUpdateProperties(currentBlock.id, { cover: nextCover });
    } finally {
      setSavingProperties(false);
    }
  }

  async function removeCover() {
    setSavingProperties(true);
    try {
      await onUpdateProperties(currentBlock.id, { cover: "" });
      setCoverOpen(false);
    } finally {
      setSavingProperties(false);
    }
  }

  async function updateIcon(nextIcon: string) {
    setSavingProperties(true);
    try {
      await onUpdateProperties(currentBlock.id, { icon: nextIcon });
      setIconOpen(false);
    } finally {
      setSavingProperties(false);
    }
  }

  async function removeIcon() {
    setSavingProperties(true);
    try {
      await onUpdateProperties(currentBlock.id, { icon: "" });
      setIconOpen(false);
    } finally {
      setSavingProperties(false);
    }
  }

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
    <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 bg-white px-4 pb-2 pt-2">
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
            {formatRelativeTime(new Date(currentBlock.updatedAt), locale)}
          </time>
          <Button
            type="button"
            onClick={onOpenShare}
            variant="link"
            size="sm"
            className="h-7 w-7 cursor-pointer p-0"
            aria-label={t("editor.share")}
          >
            <Share2 />
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-7 w-7 cursor-pointer p-0"
            aria-label={t("editor.favorite")}
            onClick={() => void toggleFavorite()}
            disabled={savingProperties}
          >
            <Star
              className={favorite ? "fill-yellow-400 text-yellow-400" : ""}
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="link"
                size="sm"
                className="h-7 w-7 cursor-pointer p-0"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
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

      {cover ? (
        <div
          className={`relative -mx-4 ${icon ? "mb-14" : "mb-2"} h-70`}
        >
          <div className="absolute inset-0 overflow-hidden bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="relative mx-auto h-full w-[720px] max-w-full">
            {icon ? (
              <div className="absolute -bottom-[51px] left-0 flex h-[102px] w-[78px] items-center justify-center text-[78px] leading-none">
                {icon}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!cover && icon ? (
        <div className="mx-auto w-[720px] max-w-full">
          <div className="flex h-[102px] w-[78px] items-center justify-center text-[78px] leading-none">
            {icon}
          </div>
        </div>
      ) : null}

      <div className="mx-auto mb-2 flex h-10 w-[720px] max-w-full items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (cover) {
              setCoverOpen(true);
            } else {
              void addRandomCover();
            }
          }}
          disabled={savingProperties}
        >
          <ImageIcon />
          {cover ? t("editor.changeCover") : t("editor.addCover")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIconOpen(true)}
          disabled={savingProperties}
        >
          <SmilePlus />
          {icon ? t("editor.changeIcon") : t("editor.addIcon")}
        </Button>
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
        className="block mx-auto w-[720px] max-w-full border-0 bg-transparent text-4xl font-semibold tracking-tight outline-none placeholder:text-zinc-300"
        placeholder={t("editor.placeholder")}
      />

      <input
        ref={markdownInputRef}
        type="file"
        accept=".md,text/markdown,text/plain"
        className="hidden"
        onChange={handleMarkdownImport}
      />

      <div className="mx-auto mt-8 w-[720px] max-w-full">
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

      <PageCoverDialog
        open={coverOpen}
        coverUrl={cover}
        onClose={() => setCoverOpen(false)}
        onSelect={(url) => void updateCover(url)}
        onRemove={() => void removeCover()}
        onUploadImage={onUploadImage}
      />

      <PageIconDialog
        open={iconOpen}
        icon={icon}
        onClose={() => setIconOpen(false)}
        onSelect={(nextIcon) => void updateIcon(nextIcon)}
        onRemove={() => void removeIcon()}
      />
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
