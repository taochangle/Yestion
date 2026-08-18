"use client";

import { useRouter } from "next/navigation";
import {
  FilePlus2,
  FolderPlus,
  Maximize2,
  MessageCircle,
  PanelRight,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { useState } from "react";
import ChatConversation from "@/components/chat-conversation";
import { useChat } from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

export default function AiPanel({
  variant,
  workspaceName,
  workspaceId,
  pageId,
  onOpenSource,
  onInsertToDocument,
  onDuplicatePage,
  onInsertSubPage,
  onCreateDocument,
  onCreateWorkspace,
  onDeleteDocument,
  onFloat,
  onDock,
  onClose
}: {
  variant: "sidebar" | "float";
  workspaceName?: string;
  workspaceId?: string;
  pageId?: string;
  onOpenSource?: (blockId: string) => void;
  onInsertToDocument?: (markdown: string) => void;
  onDuplicatePage?: () => void;
  onInsertSubPage?: () => void;
  onCreateDocument?: (title: string) => Promise<void>;
  onCreateWorkspace?: (name: string) => Promise<void>;
  onDeleteDocument?: () => void;
  onFloat: () => void;
  onDock: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [creatingDocument, setCreatingDocument] = useState(false);
  const { conversations, activeConversationKey, handleNewConversation } =
    useChat();
  const title =
    conversations.find((item) => item.key === activeConversationKey)?.label ??
    t("chat.title");
  const modeIcon =
    variant === "float" ? (
      <MessageCircle />
    ) : variant === "sidebar" ? (
      <PanelRight />
    ) : (
      <Maximize2 />
    );

  return (
    <aside
      className={`flex flex-col border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${
        variant === "sidebar"
          ? "h-full w-[462px] shrink-0 border-l"
          : "fixed bottom-4 right-4 z-40 h-[500px] w-[450px] overflow-hidden rounded-xl border shadow-2xl"
      }`}
    >
      <header className="flex h-[44px] shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="min-w-0 truncate text-sm font-medium leading-none text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-7 w-7 cursor-pointer p-0"
                  onClick={handleNewConversation}
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("chat.newConversation")}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-7 w-7 cursor-pointer p-0"
                    >
                      {modeIcon}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("ai.switchMode")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={onFloat}
                  className={variant === "float" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
                >
                  <MessageCircle size={14} />
                  {t("ai.float")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDock}
                  className={variant === "sidebar" ? "bg-zinc-100 dark:bg-zinc-800" : ""}
                >
                  <PanelRight size={14} />
                  {t("ai.sidebar")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/chat")}>
                  <Maximize2 size={14} />
                  {t("ai.fullscreen")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {onDuplicatePage ||
            onInsertSubPage ||
            onCreateDocument ||
            onCreateWorkspace ||
            onDeleteDocument ? (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-7 w-7 cursor-pointer p-0"
                      >
                        <FilePlus2 />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t("ai.documentActions")}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-44">
                  {onDuplicatePage ? (
                    <DropdownMenuItem onClick={onDuplicatePage}>
                      <FolderPlus size={14} />
                      {t("ai.duplicatePage")}
                    </DropdownMenuItem>
                  ) : null}
                  {onInsertSubPage ? (
                    <DropdownMenuItem onClick={onInsertSubPage}>
                      <Plus size={14} />
                      {t("ai.insertSubPage")}
                    </DropdownMenuItem>
                  ) : null}
                  {onCreateDocument ? (
                    <DropdownMenuItem
                      onClick={() => {
                        setNewDocumentTitle("");
                        setDocumentOpen(true);
                      }}
                    >
                      <Plus size={14} />
                      {t("ai.newDocument")}
                    </DropdownMenuItem>
                  ) : null}
                  {onCreateWorkspace ? (
                    <DropdownMenuItem
                      onClick={() => {
                        setNewWorkspaceName("");
                        setWorkspaceOpen(true);
                      }}
                    >
                      <FolderPlus size={14} />
                      {t("ai.newWorkspace")}
                    </DropdownMenuItem>
                  ) : null}
                  {onDeleteDocument ? (
                    <DropdownMenuItem
                      onClick={onDeleteDocument}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 size={14} />
                      {t("ai.deleteDocument")}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-7 w-7 cursor-pointer p-0"
                  onClick={onClose}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("ai.hide")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      <ChatConversation
        workspaceName={workspaceName}
        workspaceId={workspaceId}
        pageId={pageId}
        onOpenSource={onOpenSource}
        onInsertToDocument={onInsertToDocument}
      />

      <Dialog open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ai.newWorkspace")}</DialogTitle>
            <DialogDescription>
              {t("ai.workspaceNameHint")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ai-workspace-name">{t("common.name")}</Label>
            <Input
              id="ai-workspace-name"
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newWorkspaceName.trim()) {
                  void confirmCreateWorkspace();
                }
              }}
              placeholder={t("ai.workspaceNamePlaceholder")}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWorkspaceOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!newWorkspaceName.trim() || creatingWorkspace}
              onClick={() => void confirmCreateWorkspace()}
            >
              {creatingWorkspace ? t("common.loading") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={documentOpen} onOpenChange={setDocumentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ai.newDocument")}</DialogTitle>
            <DialogDescription>{t("ai.documentNameHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ai-document-title">{t("common.name")}</Label>
            <Input
              id="ai-document-title"
              value={newDocumentTitle}
              onChange={(event) => setNewDocumentTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newDocumentTitle.trim()) {
                  void confirmCreateDocument();
                }
              }}
              placeholder={t("ai.documentNamePlaceholder")}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!newDocumentTitle.trim() || creatingDocument}
              onClick={() => void confirmCreateDocument()}
            >
              {creatingDocument ? t("common.loading") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );

  async function confirmCreateDocument() {
    if (!onCreateDocument || !newDocumentTitle.trim()) {
      return;
    }
    setCreatingDocument(true);
    try {
      await onCreateDocument(newDocumentTitle.trim());
      setDocumentOpen(false);
    } finally {
      setCreatingDocument(false);
    }
  }

  async function confirmCreateWorkspace() {
    if (!onCreateWorkspace || !newWorkspaceName.trim()) {
      return;
    }
    setCreatingWorkspace(true);
    try {
      await onCreateWorkspace(newWorkspaceName.trim());
      setWorkspaceOpen(false);
    } finally {
      setCreatingWorkspace(false);
    }
  }
}
