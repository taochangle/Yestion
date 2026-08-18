"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import Latex from "@ant-design/x-markdown/plugins/Latex";
import { Avatar } from "antd";
import {
  Bot,
  Brain,
  BookOpen,
  FilePlus2,
  RefreshCw,
  User
} from "lucide-react";
import { useChat } from "@/components/chat-context";
import type { ChatMessage } from "@/components/chat-provider";
import { useI18n } from "@/lib/i18n";

type RenderedMessage = ChatMessage & { status?: string; messageId?: string };

function AssistantMessage({
  content,
  workspaceName,
  onOpenSource,
  onRegenerate,
  onInsertToDocument
}: {
  content: RenderedMessage;
  workspaceName: string;
  onOpenSource?: (blockId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onInsertToDocument?: (markdown: string) => void;
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
      <XMarkdown
        content={content.content}
        openLinksInNewTab
        escapeRawHtml
        config={{ extensions: Latex() }}
      />
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
          ...(onInsertToDocument
            ? [
                {
                  key: "insert",
                  icon: <FilePlus2 size={14} />,
                  label: t("ai.insertToDocument"),
                  onItemClick: () => onInsertToDocument(content.content)
                }
              ]
            : []),
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

export default function ChatConversation({
  workspaceName,
  workspaceId,
  pageId,
  onOpenSource,
  onInsertToDocument
}: {
  workspaceName?: string;
  workspaceId?: string;
  pageId?: string;
  onOpenSource?: (blockId: string) => void;
  onInsertToDocument?: (markdown: string) => void;
}) {
  const { t } = useI18n();
  const {
    knowledgeEnabled,
    setKnowledgeEnabled,
    thinkingEnabled,
    setThinkingEnabled,
    messages,
    onRequest,
    onReload,
    isRequesting,
    abort
  } = useChat();
  const [value, setValue] = useState("");
  const bubbleListRef = useRef<React.ComponentRef<typeof Bubble.List>>(null);

  useEffect(() => {
    const list = bubbleListRef.current;
    if (!list?.scrollBoxNativeElement) {
      return;
    }
    try {
      list.scrollTo?.({ top: "bottom", behavior: "auto" });
    } catch {
      // scroll box not ready yet; the next update will retry
    }
  }, [isRequesting, messages]);

  const handleSubmit = useCallback(
    (content: string) => {
      if (!content.trim()) {
        return;
      }
      onRequest({
        messages: [{ role: "user", content }],
        ...(workspaceId ? { workspaceId } : {}),
        ...(pageId ? { pageId } : {})
      });
      setValue("");
    },
    [onRequest, pageId, workspaceId]
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
            workspaceName={workspaceName || ""}
            onOpenSource={onOpenSource}
            onRegenerate={handleRegenerate}
            onInsertToDocument={onInsertToDocument}
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
    [handleRegenerate, onInsertToDocument, onOpenSource, workspaceName]
  );

  const items = messages.map(({ id, message, status }) => ({
    key: id,
    role: message.role,
    content: { ...message, status, messageId: String(id) },
    loading: status === "loading"
  }));

  return (
    <>
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
              ref={bubbleListRef}
              role={roleConfig}
              items={items}
              autoScroll
              className="min-h-0 flex-1"
            />
          </div>
        )}
      </div>

      <div className="shrink-0 p-3">
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
    </>
  );
}
