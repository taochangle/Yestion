"use client";

import { useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PopconfirmProps = {
  title: ReactNode;
  description?: ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  children?: ReactNode;
  /** Position the invisible anchor point when no trigger child is used. */
  anchorClassName?: string;
};

export default function Popconfirm({
  title,
  description,
  okText = "OK",
  cancelText = "Cancel",
  danger = false,
  side = "top",
  align = "center",
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  children,
  anchorClassName
}: PopconfirmProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (!controlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  const handleConfirm = () => {
    setOpen(false);
    onConfirm?.();
  };

  const handleCancel = () => {
    setOpen(false);
    onCancel?.();
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setOpen}>
      {children ? (
        <Popover.Trigger asChild>{children}</Popover.Trigger>
      ) : (
        <Popover.Anchor asChild>
          <span
            aria-hidden
            className={cn("inline-block", anchorClassName)}
          />
        </Popover.Anchor>
      )}

      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={6}
          className="z-50 w-64 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg outline-none dark:border-zinc-700 dark:bg-zinc-900"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {title}
          </p>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={danger ? "destructive" : "default"}
              size="sm"
              onClick={handleConfirm}
            >
              {okText}
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
