"use client";

import { MoreHorizontal, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import ChatConversation from "@/components/chat-conversation";
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
    activeConversationKey,
    handleNewConversation,
    deleteConversation
  } = useChat();

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

      <ChatConversation
        workspaceName={breadcrumb[0]?.title}
        onOpenSource={onOpenSource}
      />
    </main>
  );
}
