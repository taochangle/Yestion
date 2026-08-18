"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Actions,
  Bubble,
  Prompts,
  Sender,
  Sources,
  Think,
  Welcome
} from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
import { Avatar } from "antd";
import {
  Bot,
  Brain,
  BookOpen,
  MoreHorizontal,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Trash2,
  User
} from "lucide-react";
import { useChat } from "@/components/chat-context";
import type { ChatMessage } from "@/components/chat-provider";
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

type RenderedMessage = ChatMessage & { status?: string; messageId?: string };

function AssistantMessage({
  content,
  workspaceName,
  onOpenSource,
  onRegenerate
}: {
  content: RenderedMessage;
  workspaceName: string;
  onOpenSource?: (blockId: string) => void;
  onRegenerate?: (messageId: string) => void;
}) {
  const { t } = useI18n();
  const streaming =
    content.status === "loading" || content.status === "updating";

  return (
    <div className="space-y-3">
      {content.reasoning ? (
        <Think
          title={t("chat.thinking")}
          loading={streaming}
          blink={content.status === "updating"}
          defaultExpanded={false}
        >
          {content.reasoning}
        </Think>
      ) : null}
      <XMarkdown content={content.content} openLinksInNewTab escapeRawHtml />
      {content.sources && content.sources.length > 0 ? (
        <Sources
          title={t("chat.sourcesTitle", { count: content.sources.length })}
          items={content.sources.map((source) => ({
            key: source.documentId,
            title: (source.workspaceName || workspaceName)
              ? `${source.workspaceName || workspaceName} / ${
                  source.title || t("editor.placeholder")
                }`
              : source.title || t("editor.placeholder")
          }))}
          onClick={(item) => onOpenSource?.(String(item.key))}
        />
      ) : null}
      <Actions
        items={[
          {
            key: "copy",
            actionRender: () => <Actions.Copy text={content.content} />
          },
          {
            key: "regenerate",
            icon: <RefreshCw size={14} />,
            label: t("chat.regenerate"),
            onItemClick: () => {
              if (content.messageId) {
                onRegenerate?.(content.messageId);
              }
            }
          }
        ]}
      />
    </div>
  );
}

type ChatPanelProps = {
  breadcrumb: BreadcrumbItem[];
  sidebarCollapsed: boolean;
  onOpenSidebar: () => void;
  onOpenSource?: (blockId: string) => void;
};

export default function ChatPanel({
  breadcrumb,
  sidebarCollapsed,
  onOpenSidebar,
  onOpenSource
}: ChatPanelProps) {
  const { t } = useI18n();
  const {
    knowledgeEnabled,
    setKnowledgeEnabled,
    thinkingEnabled,
    setThinkingEnabled,
    activeConversationKey,
    messages,
    onRequest,
    onReload,
    isRequesting,
    abort,
    handleNewConversation,
    deleteConversation
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

  const handleRegenerate = useCallback(
    (assistantId: string) => {
      const index = messages.findIndex(
        (item) => String(item.id) === assistantId
      );
      let question = "";
      for (let i = index - 1; i >= 0; i -= 1) {
        if (messages[i].message.role === "user") {
          question = messages[i].message.content;
          break;
        }
      }
      if (!question) {
        return;
      }
      onReload(assistantId, {
        messages: [{ role: "user", content: question }]
      });
    },
    [messages, onReload]
  );

  const promptItems = useMemo(
    () => [
      { key: "summarize", label: t("chat.promptSummarize") },
      { key: "find", label: t("chat.promptFind") },
      { key: "databases", label: t("chat.promptDatabases") }
    ],
    [t]
  );

  const workspaceName = breadcrumb[0]?.title || "";
  const roleConfig = useMemo(
    () => ({
      assistant: {
        placement: "start" as const,
        avatar: (
          <Avatar icon={<Bot size={16} />} style={{ background: "#6366f1" }} />
        ),
        contentRender: (content: RenderedMessage) => (
          <AssistantMessage
            content={content}
            workspaceName={workspaceName}
            onOpenSource={onOpenSource}
            onRegenerate={handleRegenerate}
          />
        )
      },
      user: {
        placement: "end" as const,
        avatar: (
          <Avatar icon={<User size={16} />} style={{ background: "#0ea5e9" }} />
        ),
        contentRender: (content: RenderedMessage) => content.content
      }
    }),
    [handleRegenerate, onOpenSource, workspaceName]
  );

  const items = messages.map(({ id, message, status }) => ({
    key: id,
    role: message.role,
    content: { ...message, status, messageId: String(id) },
    loading: status === "loading"
  }));

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col px-4">
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
            onConfirm={() => deleteConversation(activeConversationKey)}
          >
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-7 w-7 cursor-pointer p-0"
              aria-label={t("chat.deleteConversation")}
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
          placeholder={t("chat.placeholder")}
          className="mx-auto max-w-3xl"
          suffix={false}
          footer={(actionNode) => (
            <div className="flex items-center justify-between gap-3 px-1 pb-1">
              <div className="flex items-center gap-2">
                <Sender.Switch
                  value={knowledgeEnabled}
                  onChange={setKnowledgeEnabled}
                  icon={<BookOpen size={14} />}
                  checkedChildren={t("chat.useWorkspaceOn")}
                  unCheckedChildren={t("chat.useWorkspaceOff")}
                />
                <Sender.Switch
                  value={thinkingEnabled}
                  onChange={setThinkingEnabled}
                  icon={<Brain size={14} />}
                  checkedChildren={t("chat.thinkingOn")}
                  unCheckedChildren={t("chat.thinkingOff")}
                />
              </div>
              <div className="flex items-center">{actionNode}</div>
            </div>
          )}
        />
      </div>
    </main>
  );
}
