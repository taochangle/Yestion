"use client";

import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

type PageIconDialogProps = {
  open: boolean;
  icon: string;
  onClose: () => void;
  onSelect: (icon: string) => void;
  onRemove: () => void;
};

const emojis = [
  "📄",
  "📝",
  "🗂️",
  "📌",
  "⭐",
  "🚀",
  "🧠",
  "💡",
  "🎯",
  "✅",
  "📚",
  "🧩",
  "🌿",
  "🔥",
  "🎨",
  "🔖"
];

export default function PageIconDialog({
  open,
  icon,
  onClose,
  onSelect,
  onRemove
}: PageIconDialogProps) {
  const { t } = useI18n();
  const [customIcon, setCustomIcon] = useState("");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SmilePlus size={18} />
            {t("icon.title")}
          </DialogTitle>
          <DialogDescription>{t("icon.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-8 gap-2">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className="flex h-9 items-center justify-center rounded-md text-xl hover:bg-zinc-100"
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={customIcon}
            onChange={(event) => setCustomIcon(event.target.value)}
            placeholder={t("icon.customPlaceholder")}
            className="min-w-0 flex-1"
            maxLength={4}
          />
          <Button
            type="button"
            onClick={() => {
              const value = customIcon.trim();
              if (value) {
                onSelect(value);
              }
            }}
            disabled={!customIcon.trim()}
          >
            {t("icon.useCustom")}
          </Button>
        </div>

        {icon ? (
          <Button
            type="button"
            variant="ghost"
            className="text-red-600 hover:text-red-600"
            onClick={onRemove}
          >
            {t("icon.remove")}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
