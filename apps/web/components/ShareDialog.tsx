"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { apiFetch, BlockNode, Share } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type ShareDialogProps = {
  block: BlockNode;
  onClose: () => void;
};

export default function ShareDialog({ block, onClose }: ShareDialogProps) {
  const { t } = useI18n();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    apiFetch<{ shares: Share[] }>(`/api/blocks/${block.id}/shares`)
      .then((result) => {
        if (!ignore) {
          setShares(result.shares);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setMessage(
            error instanceof Error ? error.message : t("share.failedLoad")
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
  }, [block.id, t]);

  async function createShare() {
    setCreating(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ share: Share }>(
        `/api/blocks/${block.id}/shares`,
        {
          method: "POST",
          body: JSON.stringify({ permission: "read" })
        }
      );
      setShares((current) => [result.share, ...current]);
      await copyShareLink(result.share.token);
      setMessage(t("share.created"));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("share.failedCreate")
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyShareLink(token: string) {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
  }

  async function confirmRevoke() {
    const shareId = pendingRevokeId;
    setPendingRevokeId(null);
    if (!shareId) {
      return;
    }

    try {
      await apiFetch<void>(`/api/shares/${shareId}`, { method: "DELETE" });
      setShares((current) => current.filter((share) => share.id !== shareId));
      setMessage(t("share.revoked"));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("share.failedRevoke")
      );
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{t("share.title")}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {block.properties.title || t("editor.placeholder")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-100"
              aria-label={t("common.close")}
            >
              ×
            </button>
          </div>

          <button
            type="button"
            onClick={createShare}
            disabled={creating}
            className="mt-5 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {creating ? t("share.creating") : t("share.create")}
          </button>

          {message && (
            <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
              {message}
            </p>
          )}

          {loading ? (
            <p className="mt-5 text-sm text-zinc-500">{t("share.loading")}</p>
          ) : (
            <div className="mt-5 space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800">
                      /shared/{share.token}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {share.permission}
                      {share.expiresAt ? ` · expires ${share.expiresAt}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyShareLink(share.token)}
                    className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                  >
                    {t("common.copy")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRevokeId(share.id)}
                    className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    {t("share.revoke")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingRevokeId !== null}
        title={t("share.revokeTitle")}
        message={t("share.revokeMessage")}
        confirmLabel={t("share.revoke")}
        danger
        onConfirm={confirmRevoke}
        onCancel={() => setPendingRevokeId(null)}
      />
    </>
  );
}
