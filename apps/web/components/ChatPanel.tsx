"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bubble,
  Conversations,
  Prompts,
  Sender,
  Welcome,
  XProvider
} from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
import {
  OpenAIChatProvider,
  useXChat,
  useXConversations,
  XRequest
} from "@ant-design/x-sdk";
import { Avatar, Switch, theme as antdTheme } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import {
  Bot,
  MoreHorizontal,
  PanelLeftOpen,
  Plus,
  Trash2,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { type BreadcrumbItem } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

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

// Providers bake workspaceId + knowledge flag into the request params, so the
// cache is keyed by all three inputs.
const providerCache = new Map<string, OpenAIChatProvider>();

function getProvider(
  conversationKey: string,
  workspaceId: string,
  knowledgeEnabled: boolean
): OpenAIChatProvider {
  const cacheKey = `${workspaceId}:${knowledgeEnabled ? 1 : 0}:${conversationKey}`;
  let provider = providerCache.get(cacheKey);
  if (!provider) {
    provider = new OpenAIChatProvider({
      request: XRequest("/api/chat", {
        manual: true,
        params: { workspaceId, useKnowledge: knowledgeEnabled }
      })
    });
    providerCache.set(cacheKey, provider);
  }
  return provider;
}

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

type ChatPanelProps = {
  workspaceId: string;
  breadcrumb: BreadcrumbItem[];
  sidebarCollapsed: boolean;
  onOpenSidebar: () => void;
};

export default function ChatPanel({
  workspaceId,
  breadcrumb,
  sidebarCollapsed,
  onOpenSidebar
}: ChatPanelProps) {
  const { t, locale } = useI18n();
  const resolvedTheme = useResolvedTheme();
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(true);
  const [value, setValue] = useState("");

  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    removeConversation
  } = useXConversations({
    defaultConversations: [{ key: "default", label: t("chat.newConversation") }],
    defaultActiveConversationKey: "default"
  });

  const { messages, onRequest, isRequesting, abort } = useXChat({
    provider: getProvider(activeConversationKey, workspaceId, knowledgeEnabled),
    conversationKey: activeConversationKey,
    requestFallback: (_, { error: requestError, messageInfo }) => {
      if (requestError?.name === "AbortError") {
        return {
          content: messageInfo?.message?.content || "",
          role: "assistant"
        };
      }
      return { content: t("chat.requestFailed"), role: "assistant" };
    }
  });

  const handleNewConversation = useCallback(() => {
    const key = `conv-${Date.now()}`;
    addConversation({
      key,
      label: `${t("chat.newConversation")} ${conversations.length + 1}`
    });
    setActiveConversationKey(key);
  }, [addConversation, conversations.length, setActiveConversationKey, t]);

  const handleDeleteConversation = useCallback(() => {
    removeConversation(activeConversationKey);
    const key = `conv-${Date.now()}`;
    addConversation({ key, label: t("chat.newConversation") });
    setActiveConversationKey(key);
  }, [
    activeConversationKey,
    addConversation,
    removeConversation,
    setActiveConversationKey,
    t
  ]);

  const handleSubmit = useCallback(
    (content: string) => {
      if (!content.trim() || !workspaceId) {
        return;
      }
      onRequest({ messages: [{ role: "user", content }] });
    },
    [onRequest, workspaceId]
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
    <XProvider
      theme={{
        algorithm:
          resolvedTheme === "dark"
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm
      }}
      locale={locale === "zh" ? zhCN : enUS}
    >
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDeleteConversation}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 />
                  {t("chat.deleteConversation")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              <Conversations
                items={conversations}
                activeKey={activeConversationKey}
                onActiveChange={setActiveConversationKey}
                menu={(conversation) => ({
                  items: [
                    {
                      key: "delete",
                      label: t("common.delete"),
                      danger: true
                    }
                  ],
                  onClick: ({ key }) => {
                    if (key === "delete") {
                      removeConversation(conversation.key);
                    }
                  }
                })}
              />
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
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
                    onItemClick={(info) =>
                      handleSubmit(String(info.data.label))
                    }
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
              />
            </div>
          </section>
        </div>
      </main>
    </XProvider>
  );
}
