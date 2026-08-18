"use client";

import { FormEvent, useState } from "react";
import { Conversations } from "@ant-design/x";
import {
  ChevronDown,
  Check,
  Database,
  Home,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  User as UserIcon,
  X
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useChat } from "@/components/chat-context";
import PageTree from "@/components/PageTree";
import SettingsDialog from "@/components/SettingsDialog";
import Popconfirm from "@/components/ui/popconfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { BlockNode, User, Workspace } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type WorkspaceSidebarProps = {
  user: User;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  blocks: BlockNode[];
  selectedBlockId: string | null;
  collapsed: boolean;
  mode: "home" | "chat";
  onToggleCollapsed: () => void;
  onModeChange: (mode: "home" | "chat") => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectBlock: (block: BlockNode) => void;
  onUpdateWorkspace: (workspaceId: string, name: string) => Promise<void>;
  onDeleteWorkspace: (workspaceId: string) => Promise<void>;
  onOpenSearch: () => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onCreatePage: (parentId: string | null) => Promise<void>;
  onCreateDatabase: (parentId: string | null) => Promise<void>;
  onDeletePage: (blockId: string) => Promise<void>;
  onMoveBlock: (
    blockId: string,
    parentId: string | null,
    position: number,
    clearParent: boolean
  ) => Promise<void>;
  onLogout: () => void;
};

export default function WorkspaceSidebar({
  user,
  workspaces,
  activeWorkspaceId,
  blocks,
  selectedBlockId,
  collapsed,
  mode,
  onToggleCollapsed,
  onModeChange,
  onSelectWorkspace,
  onSelectBlock,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onOpenSearch,
  onCreateWorkspace,
  onCreatePage,
  onCreateDatabase,
  onDeletePage,
  onMoveBlock,
  onLogout
}: WorkspaceSidebarProps) {
  const { t } = useI18n();
  const chat = useChat();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(
    null
  );
  const [editingWorkspaceName, setEditingWorkspaceName] = useState("");
  const [pendingDeleteWorkspaceId, setPendingDeleteWorkspaceId] = useState<
    string | null
  >(null);

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) {
      return;
    }

    setCreating(true);
    try {
      await onCreateWorkspace(name);
      setNewWorkspaceName("");
    } finally {
      setCreating(false);
    }
  }

  async function saveWorkspaceName(workspaceId: string) {
    const name = editingWorkspaceName.trim();
    if (!name) {
      setEditingWorkspaceId(null);
      return;
    }
    await onUpdateWorkspace(workspaceId, name);
    setEditingWorkspaceId(null);
  }

  async function confirmDeleteWorkspace() {
    const workspaceId = pendingDeleteWorkspaceId;
    setPendingDeleteWorkspaceId(null);
    if (workspaceId) {
      await onDeleteWorkspace(workspaceId);
    }
  }

  return (
    <>
      <aside className={`relative flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 ${collapsed ? "w-0 overflow-hidden" : "w-[270px]"}`}>
      <div className="border-b border-zinc-200 px-4 pb-4 pt-2">
        {collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onToggleCollapsed}
          >
            <PanelLeftOpen size={14} />
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="justify-start pl-0">
                    <UserIcon size={14} />
                    {user.name}
                    <ChevronDown size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[300px]">
                  <div className="flex items-center gap-2 px-2 py-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-200">
                      <UserIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user.name}</p>
                      <p className="truncate text-xs text-zinc-500">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                    <Settings size={14} />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout}>
                    <LogOut size={14} />
                    {t("sidebar.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="pr-0"
                onClick={onToggleCollapsed}
              >
                <PanelLeftClose size={14} />
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onModeChange("home")}
                  className={`h-7 justify-center px-2.5 ${
                    mode === "home" ? "bg-zinc-200 text-zinc-900" : ""
                  }`}
                >
                  <Home size={14} />
                  {mode === "home" ? t("sidebar.home") : null}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onModeChange("chat")}
                  className={`h-7 justify-center px-2.5 ${
                    mode === "chat" ? "bg-zinc-200 text-zinc-900" : ""
                  }`}
                >
                  <MessageCircle size={14} />
                  {mode === "chat" ? t("sidebar.chat") : null}
                </Button>
              </div>
              <Button
                type="button"
                onClick={onOpenSearch}
                variant="ghost"
                size="sm"
                className="ml-auto h-8 w-8 justify-end p-0"
                aria-label={t("sidebar.search")}
              >
                <Search size={14} />
              </Button>
            </div>
          </>
        )}
      </div>

      {mode === "home" ? (
        <>
      <div className={`border-b border-zinc-200 px-4 py-3 ${collapsed ? "hidden" : ""}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t("sidebar.workspaces")}
          </p>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              onClick={() => {
                const workspace = workspaces.find(
                  (item) => item.id === activeWorkspaceId
                );
                setEditingWorkspaceId(activeWorkspaceId);
                setEditingWorkspaceName(workspace?.name ?? "");
              }}
              disabled={!activeWorkspaceId}
              variant="ghost"
              size="sm"
              className="h-7 w-6 justify-end p-0"
              aria-label="Edit workspace"
            >
              <Pencil size={13} />
            </Button>
            <Button
              type="button"
              onClick={() => setPendingDeleteWorkspaceId(activeWorkspaceId)}
              disabled={!activeWorkspaceId}
              variant="ghost"
              size="sm"
              className="h-7 w-6 justify-end p-0 hover:text-red-600"
              aria-label="Delete workspace"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </div>

        <div className="mt-2">
          {editingWorkspaceId ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                value={editingWorkspaceName}
                onChange={(event) => setEditingWorkspaceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void saveWorkspaceName(editingWorkspaceId);
                  }
                  if (event.key === "Escape") {
                    setEditingWorkspaceId(null);
                  }
                }}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                onClick={() => void saveWorkspaceName(editingWorkspaceId)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Save workspace"
              >
                <Check size={13} />
              </Button>
              <Button
                type="button"
                onClick={() => setEditingWorkspaceId(null)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Cancel"
              >
                <X size={13} />
              </Button>
            </div>
          ) : (
            <Select
              value={activeWorkspaceId}
              onValueChange={onSelectWorkspace}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("sidebar.workspaces")} />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.icon ? `${workspace.icon} ` : ""}
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <form
          onSubmit={handleCreateWorkspace}
          className="mt-3 flex items-center gap-2"
        >
          <Input
            value={newWorkspaceName}
            onChange={(event) => setNewWorkspaceName(event.target.value)}
            placeholder={t("sidebar.newWorkspace")}
            className="h-8 min-w-0 flex-1"
          />
          <Button
            type="submit"
            disabled={creating || !newWorkspaceName.trim()}
            size="sm"
          >
            {t("common.add")}
          </Button>
        </form>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-20 ${collapsed ? "hidden" : ""}`}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t("sidebar.pages")}
          </p>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              onClick={() => onCreatePage(null)}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label={t("sidebar.addRootPage")}
            >
              <Plus size={13} />
            </Button>
            <Button
              type="button"
              onClick={() => onCreateDatabase(null)}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label={t("sidebar.addRootDatabase")}
            >
              <Database size={13} />
            </Button>
          </div>
        </div>

        <PageTree
          nodes={blocks}
          selectedId={selectedBlockId}
          onSelect={onSelectBlock}
          onCreateChild={onCreatePage}
          onCreateDatabase={onCreateDatabase}
          onDelete={onDeletePage}
          onMove={onMoveBlock}
        />
      </div>
        </>
        ) : (
          <div
            className={`min-h-0 flex-1 overflow-y-auto px-2 py-3 pb-20 ${
              collapsed ? "hidden" : ""
            }`}
          >
            <div className="px-2 pb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={chat.handleNewConversation}
              >
                <Plus size={14} />
                {t("chat.newConversation")}
              </Button>
            </div>
            <Conversations
              items={chat.conversations}
              activeKey={chat.activeConversationKey}
              onActiveChange={chat.setActiveConversationKey}
              menu={(conversation) => ({
                items: [
                  {
                    key: "delete",
                    danger: true,
                    label: (
                      <Popconfirm
                        title={t("chat.deleteConversationTitle")}
                        description={t("chat.deleteConversationMessage")}
                        okText={t("common.delete")}
                        cancelText={t("common.cancel")}
                        danger
                        onConfirm={() =>
                          chat.deleteConversation(conversation.key)
                        }
                      >
                        <span>{t("common.delete")}</span>
                      </Popconfirm>
                    ),
                    onClick: ({ domEvent }) => domEvent.stopPropagation()
                  }
                ]
              })}
            />
          </div>
        )}

      <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-2 ${collapsed ? "hidden" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="pointer-events-auto h-10 w-[188px] justify-center rounded-full border-zinc-300 bg-white shadow-sm"
                  onClick={() =>
                    mode === "chat"
                      ? chat.handleNewConversation()
                      : onModeChange("chat")
                  }
                >
                  <MessageCircle size={14} />
                  {t("sidebar.newChat")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("sidebar.newChat")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-events-auto h-10 w-10 rounded-full border-zinc-300 bg-white p-0 shadow-sm"
                aria-label={t("sidebar.quickCreate")}
              >
                <Plus size={15} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onCreatePage(null)}>
                <Plus size={14} />
                {t("sidebar.newPage")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateDatabase(null)}>
                <Database size={14} />
                {t("sidebar.newDatabase")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      </aside>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={user}
        workspace={workspaces.find(
          (workspace) => workspace.id === activeWorkspaceId
        )}
      />

      <ConfirmDialog
        open={pendingDeleteWorkspaceId !== null}
        title={t("workspace.deleteTitle")}
        message={t("workspace.deleteMessage")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={confirmDeleteWorkspace}
        onCancel={() => setPendingDeleteWorkspaceId(null)}
      />
    </>
  );
}
