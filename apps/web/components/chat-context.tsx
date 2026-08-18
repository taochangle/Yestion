"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useXChat, useXConversations, XRequest } from "@ant-design/x-sdk";
import type { MessageInfo } from "@ant-design/x-sdk";
import {
  YestionChatProvider,
  type ChatInput,
  type ChatMessage,
  type ChatOutput
} from "@/components/chat-provider";
import {
  apiFetch,
  type ChatConversationRecord,
  type ChatMessageRecord
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// Providers bake workspaceId + knowledge flag into the request params, so the
// cache is keyed by all three inputs.
const providerCache = new Map<string, YestionChatProvider>();

function getProvider(
  conversationKey: string,
  workspaceId: string,
  knowledgeEnabled: boolean,
  thinkingEnabled: boolean
): YestionChatProvider {
  const cacheKey = `${workspaceId}:${knowledgeEnabled ? 1 : 0}:${thinkingEnabled ? 1 : 0}:${conversationKey}`;
  let provider = providerCache.get(cacheKey);
  if (!provider) {
    provider = new YestionChatProvider({
      request: XRequest<ChatInput, ChatOutput, ChatMessage>("/api/chat", {
        manual: true,
        params: {
          workspaceId,
          useKnowledge: knowledgeEnabled,
          thinking: thinkingEnabled
        }
      })
    });
    providerCache.set(cacheKey, provider);
  }
  return provider;
}

type ConversationsState = ReturnType<typeof useXConversations>;
type ChatState = ReturnType<typeof useXChat>;

type ChatContextValue = {
  workspaceId: string;
  knowledgeEnabled: boolean;
  setKnowledgeEnabled: (value: boolean) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (value: boolean) => void;
  conversations: ConversationsState["conversations"];
  activeConversationKey: string;
  setActiveConversationKey: (key: string) => void;
  addConversation: ConversationsState["addConversation"];
  removeConversation: ConversationsState["removeConversation"];
  messages: MessageInfo<ChatMessage>[];
  onRequest: ChatState["onRequest"];
  onReload: ChatState["onReload"];
  isRequesting: boolean;
  abort: () => void;
  handleNewConversation: () => void;
  deleteConversation: (key: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

function toConversationData(record: ChatConversationRecord) {
  return { key: record.id, label: record.title };
}

export function ChatProvider({
  workspaceId,
  children
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  // Tracks conversations created this session that deserve an auto-title from
  // their first user message, and message ids already persisted to the server.
  const untitledRef = useRef(new Map<string, boolean>());
  const savedRef = useRef(new Set<string>());

  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    removeConversation,
    setConversation,
    setConversations
  } = useXConversations({
    defaultConversations: [],
    defaultActiveConversationKey: ""
  });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await apiFetch<{ conversations: ChatConversationRecord[] }>(
          "/api/chat/conversations"
        );
        if (!active) {
          return;
        }
        if (result.conversations.length === 0) {
          const created = await apiFetch<{ conversation: ChatConversationRecord }>(
            "/api/chat/conversations",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: workspaceId || null,
                title: t("chat.newConversation")
              })
            }
          );
          untitledRef.current.set(created.conversation.id, true);
          setConversations([toConversationData(created.conversation)]);
          setActiveConversationKey(created.conversation.id);
          return;
        }
        setConversations(
          result.conversations.map((conversation) =>
            toConversationData(conversation)
          )
        );
        setActiveConversationKey(result.conversations[0].id);
      } catch {
        if (active) {
          setConversations([]);
          setActiveConversationKey("");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [setActiveConversationKey, setConversations, t, workspaceId]);

  const { messages, onRequest, onReload, isRequesting, abort } = useXChat({
    provider: getProvider(
      activeConversationKey,
      workspaceId,
      knowledgeEnabled,
      thinkingEnabled
    ),
    conversationKey: activeConversationKey,
    defaultMessages: async (info?: { conversationKey?: string }) => {
      const conversationKey = info?.conversationKey;
      if (!conversationKey) {
        return [];
      }
      try {
        const result = await apiFetch<{ messages: ChatMessageRecord[] }>(
          `/api/chat/conversations/${conversationKey}/messages`
        );
        return result.messages.map((record) => {
          savedRef.current.add(record.id);
          return {
            id: record.id,
            message: {
              role: record.role,
              content: record.content,
              ...(record.reasoning ? { reasoning: record.reasoning } : {}),
              ...(record.sources?.length
                ? { sources: record.sources }
                : {})
            },
            status: "success" as const
          };
        });
      } catch {
        return [];
      }
    },
    requestFallback: (_, { error: requestError, messageInfo }) => {
      if (requestError?.name === "AbortError") {
        return {
          content: messageInfo?.message?.content || "",
          role: "assistant" as const
        };
      }
      return { content: t("chat.requestFailed"), role: "assistant" as const };
    }
  });

  // Persist completed messages to the server as they settle.
  useEffect(() => {
    if (!activeConversationKey) {
      return;
    }
    for (const item of messages) {
      const id = String(item.id);
      if (savedRef.current.has(id)) {
        continue;
      }
      const { message, status } = item;
      if (status === "local" && message.role === "user") {
        savedRef.current.add(id);
        const content = message.content;
        void apiFetch(`/api/chat/conversations/${activeConversationKey}/messages`, {
          method: "POST",
          body: JSON.stringify({ role: "user", content })
        }).catch(() => {});
        if (untitledRef.current.get(activeConversationKey)) {
          untitledRef.current.set(activeConversationKey, false);
          const title = content.slice(0, 30) || t("chat.newConversation");
          void apiFetch(`/api/chat/conversations/${activeConversationKey}`, {
            method: "PATCH",
            body: JSON.stringify({ title })
          })
            .then(() => {
              setConversation(activeConversationKey, {
                key: activeConversationKey,
                label: title
              });
            })
            .catch(() => {});
        }
      } else if (status === "success" && message.role === "assistant") {
        savedRef.current.add(id);
        void apiFetch(`/api/chat/conversations/${activeConversationKey}/messages`, {
          method: "POST",
          body: JSON.stringify({
            role: "assistant",
            content: message.content,
            reasoning: message.reasoning ?? "",
            sources: message.sources ?? []
          })
        }).catch(() => {});
      }
    }
  }, [activeConversationKey, messages, setConversation, t]);

  const handleNewConversation = useCallback(async () => {
    try {
      const result = await apiFetch<{ conversation: ChatConversationRecord }>(
        "/api/chat/conversations",
        {
          method: "POST",
          body: JSON.stringify({
            workspaceId: workspaceId || null,
            title: t("chat.newConversation")
          })
        }
      );
      untitledRef.current.set(result.conversation.id, true);
      addConversation(toConversationData(result.conversation));
      setActiveConversationKey(result.conversation.id);
    } catch {
      const key = `conv-${Date.now()}`;
      addConversation({
        key,
        label: `${t("chat.newConversation")} ${conversations.length + 1}`
      });
      setActiveConversationKey(key);
    }
  }, [
    addConversation,
    conversations.length,
    setActiveConversationKey,
    t,
    workspaceId
  ]);

  const deleteConversation = useCallback(
    (key: string) => {
      if (!key) {
        return;
      }
      removeConversation(key);
      void apiFetch(`/api/chat/conversations/${key}`, {
        method: "DELETE"
      }).catch(() => {});
      if (key === activeConversationKey) {
        void handleNewConversation();
      }
    },
    [activeConversationKey, handleNewConversation, removeConversation]
  );

  const value: ChatContextValue = {
    workspaceId,
    knowledgeEnabled,
    setKnowledgeEnabled,
    thinkingEnabled,
    setThinkingEnabled,
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    removeConversation,
    messages,
    onRequest,
    onReload,
    isRequesting,
    abort,
    handleNewConversation,
    deleteConversation
  };

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
