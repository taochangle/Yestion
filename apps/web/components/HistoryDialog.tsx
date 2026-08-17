"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { apiFetch, Revision } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type HistoryDialogProps = {
  blockId: string;
  onClose: () => void;
};

export default function HistoryDialog({
  blockId,
  onClose
}: HistoryDialogProps) {
  const { t } = useI18n();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    apiFetch<{ revisions: Revision[] }>(`/api/blocks/${blockId}/revisions`)
      .then((result) => {
        if (!ignore) {
          setRevisions(result.revisions);
        }
      })
      .catch((loadError) => {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("history.failed")
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [blockId, t]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("history.title")}</DialogTitle>
          <DialogDescription>{t("history.subtitle")}</DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="max-h-80 overflow-y-auto pr-3">
          <div className="space-y-2">
            {revisions.map((revision) => (
              <div
                key={revision.id}
                className="rounded-lg border p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">
                    {String(revision.snapshot.title ?? t("editor.placeholder"))}
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Date(revision.createdAt).toLocaleString()}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
