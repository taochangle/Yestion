"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode
} from "react";
import {
  OpenAIChatProvider,
  useXChat,
  useXConversations,
  XRequest
} from "@ant-design/x-sdk";
import type { MessageInfo, XModelMessage } from "@ant-design/x-sdk";
import { useI18n } from "@/lib/i18n";

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

type ConversationsState = ReturnType<typeof useXConversations>;
type ChatState = ReturnType<typeof useXChat>;

type ChatContextValue = {
  workspaceId: string;
  knowledgeEnabled: boolean;
  setKnowledgeEnabled: (value: boolean) => void;
  conversations: ConversationsState["conversations"];
  activeConversationKey: string;
  setActiveConversationKey: (key: string) => void;
  addConversation: ConversationsState["addConversation"];
  removeConversation: ConversationsState["removeConversation"];
  messages: MessageInfo<XModelMessage>[];
  onRequest: ChatState["onRequest"];
  isRequesting: boolean;
  abort: () => void;
  handleNewConversation: () => void;
  deleteConversation: (key: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
  workspaceId,
  children
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(true);

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

  const deleteConversation = useCallback(
    (key: string) => {
      removeConversation(key);
      if (key === activeConversationKey) {
        const nextKey = `conv-${Date.now()}`;
        addConversation({ key: nextKey, label: t("chat.newConversation") });
        setActiveConversationKey(nextKey);
      }
    },
    [activeConversationKey, removeConversation, addConversation, setActiveConversationKey, t]
  );

  const value: ChatContextValue = {
    workspaceId,
    knowledgeEnabled,
    setKnowledgeEnabled,
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    removeConversation,
    messages,
    onRequest,
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
