"use client";

import { MessageCircle, PanelLeftOpen, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

type ChatPanelProps = {
  sidebarCollapsed: boolean;
  onOpenSidebar: () => void;
};

export default function ChatPanel({
  sidebarCollapsed,
  onOpenSidebar
}: ChatPanelProps) {
  const { t } = useI18n();

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
      <header className="mb-3 flex min-h-7 items-center gap-2 text-sm">
        {sidebarCollapsed && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onOpenSidebar}
          >
            <PanelLeftOpen size={14} />
          </Button>
        )}
        <MessageCircle size={16} className="text-zinc-500" />
        <span className="text-zinc-900">{t("sidebar.chat")}</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50/60">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-sm">
            <MessageCircle
              size={32}
              className="mx-auto mb-3 text-zinc-300"
            />
            <p className="text-sm text-zinc-500">{t("chat.empty")}</p>
            <p className="mt-2 text-xs text-zinc-400">{t("chat.subtitle")}</p>
          </div>
        </div>

        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex items-center gap-2 border-t border-zinc-200 bg-white p-3"
        >
          <Input
            disabled
            placeholder={t("chat.placeholder")}
            className="h-9 min-w-0 flex-1"
          />
          <Button type="submit" size="sm" disabled>
            <Send />
            {t("chat.send")}
          </Button>
        </form>
      </div>
    </main>
  );
}
