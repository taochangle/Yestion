"use client";

import { useRouter } from "next/navigation";
import { Maximize2, MessageCircle, PanelRight, Plus, X } from "lucide-react";
import ChatConversation from "@/components/chat-conversation";
import { useChat } from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";

export default function AiPanel({
  workspaceName,
  onOpenSource,
  onClose
}: {
  workspaceName?: string;
  onOpenSource?: (blockId: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { conversations, activeConversationKey, handleNewConversation } =
    useChat();
  const title =
    conversations.find((item) => item.key === activeConversationKey)?.label ??
    t("chat.title");

  return (
    <aside className="flex h-full w-[462px] shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex h-[44px] shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="min-w-0 truncate text-sm font-medium leading-none text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-7 w-7 cursor-pointer p-0"
                  onClick={handleNewConversation}
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("chat.newConversation")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-7 w-7 cursor-pointer p-0"
                  onClick={onClose}
                >
                  <MessageCircle />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("ai.float")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-7 w-7 cursor-pointer bg-zinc-100 p-0 dark:bg-zinc-800"
                  aria-pressed
                >
                  <PanelRight />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("ai.sidebar")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-7 w-7 cursor-pointer p-0"
                  onClick={() => router.push("/chat")}
                >
                  <Maximize2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("ai.fullscreen")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-7 w-7 cursor-pointer p-0"
                  onClick={onClose}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("ai.hide")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      <ChatConversation
        workspaceName={workspaceName}
        onOpenSource={onOpenSource}
      />
    </aside>
  );
}
