"use client";

import { AbstractChatProvider } from "@ant-design/x-sdk";
import type {
  SSEFields,
  TransformMessage,
  XRequestOptions
} from "@ant-design/x-sdk";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  sources?: ChatSource[];
};

export type ChatSource = {
  documentId: string;
  title: string;
  content: string;
  type: string;
  score: number;
};

export type ChatInput = {
  workspaceId?: string;
  useKnowledge?: boolean;
  useSearch?: boolean;
  messages?: Array<{
    role: string;
    content: string;
    reasoning_content?: string;
  }>;
};

export type ChatOutput = Partial<Record<SSEFields, string>>;

/**
 * OpenAI-compatible provider that also accumulates DeepSeek's
 * `reasoning_content` stream field into the ChatMessage for Think rendering.
 */
export class YestionChatProvider extends AbstractChatProvider<
  ChatMessage,
  ChatInput,
  ChatOutput
> {
  transformParams(
    requestParams: Partial<ChatInput>,
    options: XRequestOptions<ChatInput, ChatOutput, ChatMessage>
  ): ChatInput {
    return {
      ...(options?.params || {}),
      ...requestParams,
      messages: (this.getMessages() ?? []).map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.role === "assistant" && message.reasoning
          ? { reasoning_content: message.reasoning }
          : {})
      }))
    };
  }

  transformLocalMessage(requestParams: Partial<ChatInput>): ChatMessage[] {
    return (requestParams?.messages ?? []).map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content
    }));
  }

  transformMessage(
    info: TransformMessage<ChatMessage, ChatOutput>
  ): ChatMessage {
    const { originMessage, chunk } = info;

    if (chunk?.event === "sources") {
      try {
        const raw = chunk.data as string | undefined;
        if (raw) {
          const parsed = JSON.parse(raw) as { sources?: ChatSource[] };
          return {
            role: "assistant",
            content: originMessage?.content || "",
            ...(originMessage?.reasoning
              ? { reasoning: originMessage.reasoning }
              : {}),
            sources: parsed.sources ?? []
          };
        }
      } catch {
        // ignore malformed sources frame
      }
    }

    let content = "";
    let reasoning = "";

    try {
      const raw = chunk?.data as string | undefined;
      if (raw && raw.trim() !== "[DONE]") {
        const parsed = JSON.parse(raw) as {
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string };
          }>;
        };
        parsed.choices?.forEach((choice) => {
          if (choice.delta?.content) {
            content += choice.delta.content;
          }
          if (choice.delta?.reasoning_content) {
            reasoning += choice.delta.reasoning_content;
          }
        });
      }
    } catch {
      // ignore malformed frames; content is appended incrementally
    }

    return {
      role: "assistant",
      content: `${originMessage?.content || ""}${content}`,
      reasoning: `${originMessage?.reasoning || ""}${reasoning}`,
      ...(originMessage?.sources ? { sources: originMessage.sources } : {})
    };
  }
}
