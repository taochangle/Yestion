"use client";

import { useCallback, useMemo, useState } from "react";
import { Bubble, Prompts, Sender, Welcome } from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
import { Avatar, Switch } from "antd";
import {
  Bot,
  MoreHorizontal,
  PanelLeftOpen,
  Plus,
  Trash2,
  User
} from "lucide-react";
import { useChat } from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import Popconfirm from "@/components/ui/popconfirm";
import { type BreadcrumbItem } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const roleConfig = {
  assistant: {
    placement: "start" as const,
    avatar: <Avatar icon={<Bot size={16} />} style={{ background: "#6366f1" }} />,
    contentRender: (content: string) => (
      <XMarkdown content={content} openLinksInNewTab escapeRawHtml />
    )
  },
  user: {
    placement: "end" as const,
    avatar: <Avatar icon={<User size={16} />} style={{ background: "#0ea5e9" }} />
  }
};

type ChatPanelProps = {
  breadcrumb: BreadcrumbItem[];
  sidebarCollapsed: boolean;
  onOpenSidebar: () => void;
};

export default function ChatPanel({
  breadcrumb,
  sidebarCollapsed,
  onOpenSidebar
}: ChatPanelProps) {
  const { t } = useI18n();
  const {
    knowledgeEnabled,
    setKnowledgeEnabled,
    workspaceId,
    activeConversationKey,
    messages,
    onRequest,
    isRequesting,
    abort,
    handleNewConversation,
    pendingDeleteConversationKey,
    requestDeleteConversation,
    confirmDeleteConversation,
    cancelDeleteConversation
  } = useChat();
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(
    (content: string) => {
      if (!content.trim()) {
        return;
      }
      onRequest({ messages: [{ role: "user", content }] });
    },
    [onRequest]
  );

  const promptItems = useMemo(
    () => [
      { key: "summarize", label: t("chat.promptSummarize") },
      { key: "find", label: t("chat.promptFind") },
      { key: "databases", label: t("chat.promptDatabases") }
    ],
    [t]
  );

  const items = messages.map(({ id, message, status }) => ({
    key: id,
    role: message.role,
    content: message.content,
    loading: status === "loading"
  }));

  return (
    <main className="flex h-full min-h-0 flex-col px-4">
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
              <span
                className={
                  index === breadcrumb.length - 1 ? "text-zinc-900" : ""
                }
              >
                {item.title || t("chat.title")}
              </span>
            </span>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">
            {t("chat.knowledge")}
          </span>
          <Switch
            checked={knowledgeEnabled}
            onChange={setKnowledgeEnabled}
            size="small"
          />
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-7 w-7 cursor-pointer p-0"
            aria-label={t("chat.newConversation")}
            onClick={handleNewConversation}
          >
            <Plus />
          </Button>
          <Popconfirm
            title={t("chat.deleteConversationTitle")}
            description={t("chat.deleteConversationMessage")}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            danger
            open={pendingDeleteConversationKey !== null}
            onOpenChange={(next) => {
              if (!next) {
                cancelDeleteConversation();
              }
            }}
            onConfirm={confirmDeleteConversation}
          >
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-7 w-7 cursor-pointer p-0"
              aria-label={t("chat.deleteConversation")}
              onClick={() => requestDeleteConversation(activeConversationKey)}
            >
              <Trash2 />
            </Button>
          </Popconfirm>
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
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleNewConversation}>
                <Plus />
                {t("chat.newConversation")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
            <Welcome
              variant="borderless"
              icon={<Bot size={42} />}
              title={t("chat.title")}
              description={t("chat.subtitle")}
            />
            <Prompts
              title={t("chat.prompts")}
              wrap
              items={promptItems}
              onItemClick={(info) => handleSubmit(String(info.data.label))}
            />
          </div>
        ) : (
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-6">
            <Bubble.List
              role={roleConfig}
              items={items}
              autoScroll
              className="min-h-0 flex-1"
            />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <Sender
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          loading={isRequesting}
          onCancel={abort}
          disabled={!workspaceId}
          placeholder={t("chat.placeholder")}
          className="mx-auto max-w-3xl"
        />
      </div>
    </main>
  );
}
