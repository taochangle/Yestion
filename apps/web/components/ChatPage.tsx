"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Avatar, Select, Switch, theme as antdTheme } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { ArrowLeft, Bot, Plus, User } from "lucide-react";
import { apiFetch, type Workspace } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

const ACTIVE_WORKSPACE_KEY = "yestion.activeWorkspaceId";

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
// cache is keyed by all three inputs. Entries are bounded by the number of
// conversations and workspace switches a user makes.
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

export default function ChatPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const resolvedTheme = useResolvedTheme();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(true);
  const [error, setError] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await apiFetch<{ workspaces: Workspace[] }>(
          "/api/workspaces"
        );
        if (active) {
          setWorkspaces(result.workspaces);
          const saved = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
          const preferred =
            result.workspaces.find((item) => item.id === saved) ??
            result.workspaces[0];
          if (preferred) {
            setWorkspaceId(preferred.id);
          }
        }
      } catch {
        if (active) {
          setError(t("chat.loadFailed"));
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [t]);

  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    removeConversation,
    setConversations
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
      <div className="flex h-screen overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
          <div className="p-3">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleNewConversation}
            >
              <Plus size={15} />
              {t("chat.newConversation")}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
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

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push("/")}
            >
              <ArrowLeft size={15} />
              {t("chat.backToWorkspace")}
            </Button>

            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="hidden sm:inline">{t("chat.knowledge")}</span>
              <Switch
                checked={knowledgeEnabled}
                onChange={setKnowledgeEnabled}
                size="small"
              />
              <Select
                value={workspaceId || undefined}
                onChange={setWorkspaceId}
                options={workspaces.map((item) => ({
                  value: item.id,
                  label: item.name
                }))}
                placeholder={t("chat.workspace")}
                style={{ width: 200 }}
                size="small"
              />
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
                <Welcome
                  variant="borderless"
                  icon={<Bot size={42} />}
                  title={t("chat.title")}
                  description={error || t("chat.subtitle")}
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
      </div>
    </XProvider>
  );
}
