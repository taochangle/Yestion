"use client";

import { type Editor, type JSONContent } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XProvider } from "@ant-design/x";
import { theme as antdTheme } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { Bot } from "lucide-react";
import AiPanel from "@/components/AiPanel";
import ChatPanel from "@/components/ChatPanel";
import { ChatProvider } from "@/components/chat-context";
import ConfirmDialog from "@/components/ConfirmDialog";
import DatabaseView from "@/components/DatabaseView";
import MovePageDialog from "@/components/MovePageDialog";
import PageEditor from "@/components/PageEditor";
import SearchDialog from "@/components/SearchDialog";
import ShareDialog from "@/components/ShareDialog";
import TemplateDialog from "@/components/TemplateDialog";
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import {
  API_URL,
  apiFetch,
  Block,
  BlockNode,
  BreadcrumbItem,
  clearAuthCookie,
  Database,
  FileInfo,
  getCookie,
  SearchResult,
  Share,
  User,
  Workspace
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

const ACTIVE_WORKSPACE_KEY = "yestion.activeWorkspaceId";
const ACTIVE_BLOCK_PREFIX = "yestion.activeBlockId:";
const SIDEBAR_MODE_KEY = "yestion.sidebarMode";

function useResolvedTheme(): "light" | "dark" {
  const { theme } = useTheme();
  const [systemResolved, setSystemResolved] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemResolved(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return theme === "system" ? systemResolved : theme;
}

function activeBlockKey(workspaceId: string) {
  return `${ACTIVE_BLOCK_PREFIX}${workspaceId}`;
}

export default function DashboardPage({
  initialMode
}: {
  initialMode?: "home" | "chat";
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const resolvedTheme = useResolvedTheme();
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [blocks, setBlocks] = useState<BlockNode[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState<string | null>(
    null
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareBlock, setShareBlock] = useState<BlockNode | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"home" | "chat">(() => {
    if (initialMode) {
      return initialMode;
    }
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(SIDEBAR_MODE_KEY) === "chat"
        ? "chat"
        : "home";
    }
    return "home";
  });
  const [aiMode, setAiMode] = useState<"hidden" | "float" | "sidebar">(
    "hidden"
  );
  const documentEditorRef = useRef<Editor | null>(null);

  const handleInsertToEditor = useCallback((markdown: string) => {
    const editor = documentEditorRef.current;
    if (editor && markdown) {
      editor
        .chain()
        .focus()
        .insertContent(markdown, { contentType: "markdown" })
        .run();
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_MODE_KEY, sidebarMode);
  }, [sidebarMode]);
  const [error, setError] = useState<string | null>(null);

  const loadBlocks = useCallback(async (workspaceId: string, preferredBlockId?: string) => {
    const result = await apiFetch<{ blocks: BlockNode[] }>(
      `/api/workspaces/${workspaceId}/blocks`
    );
    const savedBlockId =
      preferredBlockId ?? localStorage.getItem(activeBlockKey(workspaceId));
    const nextBlockId =
      savedBlockId && findNode(result.blocks, savedBlockId)
        ? savedBlockId
        : result.blocks[0]?.id ?? null;

    setBlocks(result.blocks);
    setSelectedBlockId(nextBlockId);
    if (nextBlockId) {
      localStorage.setItem(activeBlockKey(workspaceId), nextBlockId);
    }
  }, []);

  useEffect(() => {
    if (!getCookie("auth_token")) {
      router.replace("/login");
      return;
    }

    apiFetch<{ user: User }>("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => {
        clearAuthCookie();
        router.replace("/login");
      });
  }, [router]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    apiFetch<{ workspaces: Workspace[] }>("/api/workspaces")
      .then(async (result) => {
        setWorkspaces(result.workspaces);
        if (result.workspaces.length === 0) {
          return;
        }

        const savedWorkspaceId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
        const nextWorkspaceId =
          savedWorkspaceId &&
          result.workspaces.some((workspace) => workspace.id === savedWorkspaceId)
            ? savedWorkspaceId
            : result.workspaces[0].id;

        setActiveWorkspaceId(nextWorkspaceId);
        await loadBlocks(nextWorkspaceId);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load workspace")
      );
  }, [loadBlocks, user]);

  const selectedBlock = useMemo(
    () => findNode(blocks, selectedBlockId),
    [blocks, selectedBlockId]
  );

  function handleInsertSubPage() {
    if (selectedBlock) {
      void handleCreatePage(selectedBlock.id);
    }
  }

  const breadcrumb = useMemo(
    () => {
      const workspace = workspaces.find(
        (item) => item.id === activeWorkspaceId
      );
      const items: BreadcrumbItem[] = workspace
        ? [{ id: `workspace:${workspace.id}`, title: workspace.name }]
        : [];
      const path = findPath(blocks, selectedBlockId);
      return [
        ...items,
        ...path.map((block) => ({
          id: block.id,
          title: block.properties.title || "Untitled"
        }))
      ];
    },
    [activeWorkspaceId, blocks, selectedBlockId, workspaces]
  );

  async function handleSelectWorkspace(workspaceId: string) {
    setActiveWorkspaceId(workspaceId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    await loadBlocks(workspaceId);
  }

  function handleSelectBlock(block: BlockNode) {
    setSelectedBlockId(block.id);
    if (activeWorkspaceId) {
      localStorage.setItem(activeBlockKey(activeWorkspaceId), block.id);
    }
  }

  function handleOpenChatSource(blockId: string) {
    const node = findNode(blocks, blockId);
    if (node) {
      handleSelectBlock(node);
      setSidebarMode("home");
    }
  }

  async function handleSearchSelect(result: SearchResult) {
    if (result.workspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(result.workspaceId);
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, result.workspaceId);
      await loadBlocks(result.workspaceId, result.blockId);
    } else {
      setSelectedBlockId(result.blockId);
      localStorage.setItem(activeBlockKey(activeWorkspaceId), result.blockId);
    }
    setSearchOpen(false);
  }

  async function handleTemplateInstantiated(blockId: string) {
    if (activeWorkspaceId) {
      await loadBlocks(activeWorkspaceId, blockId);
    }
    setTemplateOpen(false);
  }

  async function handleCopyLink() {
    if (!selectedBlock) {
      return;
    }

    const result = await apiFetch<{ share: Share }>(
      `/api/blocks/${selectedBlock.id}/shares`,
      {
        method: "POST",
        body: JSON.stringify({ permission: "read" })
      }
    );
    await navigator.clipboard.writeText(
      `${window.location.origin}/shared/${result.share.token}`
    );
  }

  async function handleDuplicatePage() {
    if (!selectedBlock || !activeWorkspaceId) {
      return;
    }

    const result = await apiFetch<{ block: Block }>("/api/blocks", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: activeWorkspaceId,
        parentId: selectedBlock.parentId,
        type: "page",
        title: `${selectedBlock.properties.title || "Untitled"} Copy`
      })
    });

    if (selectedBlock.properties.content) {
      await apiFetch<{ block: Block }>(`/api/blocks/${result.block.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            content: selectedBlock.properties.content
          }
        })
      });
    }

    await loadBlocks(activeWorkspaceId, result.block.id);
  }

  async function handleMovePageTo(parentId: string) {
    if (!selectedBlock) {
      return;
    }

    const isRoot = parentId === "";
    await handleMoveBlock(
      selectedBlock.id,
      isRoot ? null : parentId,
      0,
      isRoot
    );
    setMoveOpen(false);
  }

  async function handleCreateWorkspace(name: string) {
    const result = await apiFetch<{ workspace: Workspace }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    setWorkspaces((current) => [result.workspace, ...current]);
    setActiveWorkspaceId(result.workspace.id);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, result.workspace.id);
    await loadBlocks(result.workspace.id);
  }

  async function handleUpdateWorkspace(workspaceId: string, name: string) {
    const result = await apiFetch<{ workspace: Workspace }>(
      `/api/workspaces/${workspaceId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name })
      }
    );
    setWorkspaces((current) =>
      current.map((workspace) =>
        workspace.id === workspaceId ? result.workspace : workspace
      )
    );
  }

  async function handleDeleteWorkspace(workspaceId: string) {
    await apiFetch<void>(`/api/workspaces/${workspaceId}`, {
      method: "DELETE"
    });
    const remaining = workspaces.filter(
      (workspace) => workspace.id !== workspaceId
    );
    setWorkspaces(remaining);

    if (workspaceId !== activeWorkspaceId) {
      return;
    }

    const nextWorkspace = remaining[0];
    if (!nextWorkspace) {
      setActiveWorkspaceId("");
      setBlocks([]);
      setSelectedBlockId(null);
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      return;
    }

    setActiveWorkspaceId(nextWorkspace.id);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextWorkspace.id);
    await loadBlocks(nextWorkspace.id);
  }

  async function handleCreatePage(parentId: string | null) {
    if (!activeWorkspaceId) {
      return;
    }

    const result = await apiFetch<{ block: Block }>("/api/blocks", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: activeWorkspaceId,
        parentId,
        type: "page",
        title: "Untitled"
      })
    });
    await loadBlocks(activeWorkspaceId, result.block.id);
  }

  async function handleCreateDatabase(parentId: string | null) {
    if (!activeWorkspaceId) {
      return;
    }

    const result = await apiFetch<{ database: Database }>("/api/databases", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: activeWorkspaceId,
        parentId,
        name: "Database"
      })
    });
    await loadBlocks(activeWorkspaceId, result.database.blockId);
  }

  async function performDeletePage(blockId: string) {
    const block = findNode(blocks, blockId);
    const rowId =
      block?.properties.rowId && typeof block.properties.rowId === "string"
        ? block.properties.rowId
        : null;
    const databaseId =
      block && (block.type === "database" || rowId) && block.properties.databaseId
        ? block.properties.databaseId
        : null;

    if (typeof rowId === "string" && typeof databaseId === "string") {
      await apiFetch<void>(
        `/api/databases/${databaseId}/rows/${rowId}`,
        { method: "DELETE" }
      );
    } else if (typeof databaseId === "string") {
      await apiFetch<void>(`/api/databases/${databaseId}`, {
        method: "DELETE"
      });
    } else {
      await apiFetch<void>(`/api/blocks/${blockId}`, { method: "DELETE" });
    }
    await loadBlocks(activeWorkspaceId);
  }

  async function requestDeletePage(blockId: string) {
    setPendingDeleteBlockId(blockId);
  }

  function confirmDeletePage() {
    const blockId = pendingDeleteBlockId;
    setPendingDeleteBlockId(null);
    if (blockId) {
      void performDeletePage(blockId);
    }
  }

  async function handleMoveBlock(
    blockId: string,
    parentId: string | null,
    position: number,
    clearParent: boolean
  ) {
    await apiFetch<{ block: Block }>(`/api/blocks/${blockId}/move`, {
      method: "POST",
      body: JSON.stringify({ parentId, position, clearParent })
    });
    await loadBlocks(activeWorkspaceId);
  }

  async function handleUpdateTitle(blockId: string, title: string) {
    await apiFetch<{ block: Block }>(`/api/blocks/${blockId}`, {
      method: "PATCH",
      body: JSON.stringify({ title })
    });
    await loadBlocks(activeWorkspaceId);
  }

  async function handleUpdateBlockProperties(
    blockId: string,
    properties: Record<string, unknown>
  ) {
    const result = await apiFetch<{ block: Block }>(`/api/blocks/${blockId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties })
    });
    setBlocks((current) =>
      updateBlockProperties(current, blockId, result.block.properties)
    );
  }

  const handleSaveContent = useCallback(
    async (blockId: string, document: JSONContent) => {
      await apiFetch<{ block: Block }>(`/api/blocks/${blockId}`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            content: document
          }
        })
      });
      setBlocks((current) =>
        updateBlockProperties(current, blockId, { content: document })
      );
    },
    []
  );

  const handleUploadImage = useCallback(async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const result = await apiFetch<{ file: FileInfo }>("/api/files/upload", {
      method: "POST",
      body
    });
    return `${API_URL}${result.file.url}`;
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const result = await apiFetch<{ file: FileInfo }>("/api/files/upload", {
      method: "POST",
      body
    });
    return `${API_URL}${result.file.url}`;
  }, []);

  const handleRefreshTree = useCallback(async () => {
    if (activeWorkspaceId) {
      await loadBlocks(activeWorkspaceId);
    }
  }, [activeWorkspaceId, loadBlocks]);

  async function handleLogout() {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
    } finally {
      clearAuthCookie();
      router.replace("/login");
    }
  }

  if (error) {
    return (
      <main className="p-8 text-red-600">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => setError(null)}
          className="mt-4 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          Dismiss
        </button>
      </main>
    );
  }

  if (!user) {
    return <main className="min-h-screen bg-zinc-50" />;
  }

  const pendingDeleteBlock = pendingDeleteBlockId
    ? findNode(blocks, pendingDeleteBlockId)
    : null;

  return (
    <ChatProvider workspaceId={activeWorkspaceId}>
      <XProvider
        theme={{
          algorithm:
            resolvedTheme === "dark"
              ? antdTheme.darkAlgorithm
              : antdTheme.defaultAlgorithm
        }}
        locale={locale === "zh" ? zhCN : enUS}
      >
      <div className="flex h-screen overflow-hidden bg-white">
        <WorkspaceSidebar
          user={user}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          collapsed={sidebarCollapsed}
          mode={sidebarMode}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          onSelectWorkspace={handleSelectWorkspace}
          onSelectBlock={handleSelectBlock}
          onUpdateWorkspace={handleUpdateWorkspace}
          onDeleteWorkspace={handleDeleteWorkspace}
          onOpenSearch={() => setSearchOpen(true)}
          onCreateWorkspace={handleCreateWorkspace}
          onCreatePage={handleCreatePage}
          onCreateDatabase={handleCreateDatabase}
          onDeletePage={requestDeletePage}
          onMoveBlock={handleMoveBlock}
          onLogout={handleLogout}
          onModeChange={setSidebarMode}
        />

        <div
          className={
            sidebarMode === "chat" ? "hidden" : "flex min-h-0 min-w-0 flex-1"
          }
        >
          {selectedBlock?.type === "database" ? (
            <DatabaseView
              key={selectedBlock.id}
              databaseBlock={selectedBlock}
              breadcrumb={breadcrumb}
              onUpdateTitle={handleUpdateTitle}
              onRefreshTree={handleRefreshTree}
              sidebarCollapsed={sidebarCollapsed}
              onOpenSidebar={() => setSidebarCollapsed(false)}
            />
          ) : (
            <PageEditor
              key={selectedBlock?.id ?? "empty"}
              selectedBlock={selectedBlock}
              breadcrumb={breadcrumb}
              editorRef={documentEditorRef}
              onUpdateTitle={handleUpdateTitle}
              onUpdateProperties={handleUpdateBlockProperties}
              onSaveContent={handleSaveContent}
              onUploadImage={handleUploadImage}
              onUploadFile={handleUploadFile}
              onOpenShare={() => {
                if (selectedBlock) {
                  setShareBlock(selectedBlock);
                }
              }}
              onCopyLink={handleCopyLink}
              onDuplicate={handleDuplicatePage}
              onMoveToTrash={() => {
                if (selectedBlock) {
                  void requestDeletePage(selectedBlock.id);
                }
              }}
              onMoveTo={() => setMoveOpen(true)}
              sidebarCollapsed={sidebarCollapsed}
              onOpenSidebar={() => setSidebarCollapsed(false)}
            />
          )}
          {aiMode === "sidebar" ? (
            <AiPanel
              variant="sidebar"
              workspaceName={
                workspaces.find((item) => item.id === activeWorkspaceId)?.name
              }
              onOpenSource={handleOpenChatSource}
              onInsertToDocument={handleInsertToEditor}
              onDuplicatePage={handleDuplicatePage}
              onInsertSubPage={handleInsertSubPage}
              onFloat={() => setAiMode("float")}
              onDock={() => setAiMode("sidebar")}
              onClose={() => setAiMode("hidden")}
            />
          ) : null}
        </div>

        {sidebarMode === "home" && aiMode === "hidden" ? (
          <button
            type="button"
            onClick={() => setAiMode("sidebar")}
            className="fixed bottom-6 right-6 z-40 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-colors hover:bg-indigo-500"
            aria-label="AI"
          >
            <Bot size={22} />
          </button>
        ) : null}

        {sidebarMode === "home" && aiMode === "float" ? (
          <AiPanel
            variant="float"
            workspaceName={
              workspaces.find((item) => item.id === activeWorkspaceId)?.name
            }
            onOpenSource={handleOpenChatSource}
            onInsertToDocument={handleInsertToEditor}
            onDuplicatePage={handleDuplicatePage}
            onInsertSubPage={handleInsertSubPage}
            onFloat={() => setAiMode("float")}
            onDock={() => setAiMode("sidebar")}
            onClose={() => setAiMode("hidden")}
          />
        ) : null}

        <div
          className={
            sidebarMode === "chat" ? "flex min-h-0 min-w-0 flex-1" : "hidden"
          }
        >
          <ChatPanel
            breadcrumb={[
              {
                id: activeWorkspaceId || "workspace",
                title:
                  workspaces.find((item) => item.id === activeWorkspaceId)
                    ?.name || t("common.workspace")
              },
              { id: "chat", title: t("sidebar.chat") }
            ]}
            sidebarCollapsed={sidebarCollapsed}
            onOpenSidebar={() => setSidebarCollapsed(false)}
            onOpenSource={handleOpenChatSource}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteBlockId !== null}
        title={t("dialog.deletePageTitle")}
        message={t("dialog.deletePageMessage", {
          title:
            pendingDeleteBlock?.properties.title ?? t("editor.placeholder")
        })}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={confirmDeletePage}
        onCancel={() => setPendingDeleteBlockId(null)}
      />

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
      />

      {shareBlock && (
        <ShareDialog
          block={shareBlock}
          onClose={() => setShareBlock(null)}
        />
      )}

      {templateOpen && activeWorkspaceId && (
        <TemplateDialog
          workspaceId={activeWorkspaceId}
          selectedBlock={selectedBlock}
          onClose={() => setTemplateOpen(false)}
          onInstantiated={handleTemplateInstantiated}
        />
      )}

      {moveOpen && selectedBlock && (
        <MovePageDialog
          blocks={blocks}
          selectedBlockId={selectedBlock.id}
          onClose={() => setMoveOpen(false)}
          onMove={handleMovePageTo}
        />
      )}
      </XProvider>
    </ChatProvider>
  );
}

function findNode(nodes: BlockNode[], blockId: string | null): BlockNode | null {
  if (!blockId) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === blockId) {
      return node;
    }
    const child = findNode(node.children, blockId);
    if (child) {
      return child;
    }
  }
  return null;
}

function findPath(nodes: BlockNode[], blockId: string | null): BlockNode[] {
  if (!blockId) {
    return [];
  }

  for (const node of nodes) {
    if (node.id === blockId) {
      return [node];
    }
    const childPath = findPath(node.children, blockId);
    if (childPath.length > 0) {
      return [node, ...childPath];
    }
  }
  return [];
}

function updateBlockProperties(
  nodes: BlockNode[],
  blockId: string,
  properties: Record<string, unknown>
): BlockNode[] {
  return nodes.map((node) => {
    if (node.id === blockId) {
      return {
        ...node,
        properties: {
          ...node.properties,
          ...properties
        }
      };
    }

    if (node.children.length > 0) {
      return {
        ...node,
        children: updateBlockProperties(node.children, blockId, properties)
      };
    }

    return node;
  });
}
