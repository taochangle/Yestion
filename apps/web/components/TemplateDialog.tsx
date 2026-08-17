"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { apiFetch, BlockNode, Template } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type TemplateDialogProps = {
  workspaceId: string;
  selectedBlock: BlockNode | null;
  onClose: () => void;
  onInstantiated: (blockId: string) => Promise<void>;
};

export default function TemplateDialog({
  workspaceId,
  selectedBlock,
  onClose,
  onInstantiated
}: TemplateDialogProps) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    apiFetch<{ templates: Template[] }>(
      `/api/templates?workspaceId=${encodeURIComponent(workspaceId)}`
    )
      .then((result) => {
        if (!ignore) {
          setTemplates(result.templates);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setMessage(
            error instanceof Error ? error.message : t("templates.loading")
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
  }, [t, workspaceId]);

  async function createBlankTemplate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage(t("templates.name"));
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ template: Template }>("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          name: trimmedName,
          description: description.trim(),
          blockType: "page",
          properties: { title: trimmedName },
          content: { type: "doc", content: [{ type: "paragraph" }] }
        })
      });
      setTemplates((current) => [result.template, ...current]);
      setName("");
      setDescription("");
      setMessage(t("templates.created"));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("templates.loading")
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveCurrentPageAsTemplate() {
    if (!selectedBlock || selectedBlock.type !== "page") {
      setMessage(t("templates.selectPage"));
      return;
    }

    const content =
      selectedBlock.properties.content &&
      typeof selectedBlock.properties.content === "object"
        ? selectedBlock.properties.content
        : { type: "doc", content: [{ type: "paragraph" }] };

    setSaving(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ template: Template }>("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          name: selectedBlock.properties.title || "Untitled template",
          description: "Saved from current page",
          blockType: "page",
          properties: {
            title: selectedBlock.properties.title || "Untitled"
          },
          content
        })
      });
      setTemplates((current) => [result.template, ...current]);
      setMessage(t("templates.saved"));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("templates.loading")
      );
    } finally {
      setSaving(false);
    }
  }

  async function instantiate(template: Template) {
    setMessage(null);
    try {
      const result = await apiFetch<{ block: BlockNode }>(
        `/api/templates/${template.id}/instantiate`,
        {
          method: "POST",
          body: JSON.stringify({ parentId: selectedBlock?.id ?? null })
        }
      );
      await onInstantiated(result.block.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("templates.loading")
      );
    }
  }

  async function confirmDeleteTemplate() {
    const templateId = pendingDeleteId;
    setPendingDeleteId(null);
    if (!templateId) {
      return;
    }

    try {
      await apiFetch<void>(`/api/templates/${templateId}`, {
        method: "DELETE"
      });
      setTemplates((current) =>
        current.filter((template) => template.id !== templateId)
      );
      setMessage(t("templates.deleted"));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("templates.loading")
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
        <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{t("templates.title")}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {t("templates.subtitle")}
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

          <div className="mt-5 grid grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("templates.name")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("templates.description")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={createBlankTemplate}
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {t("templates.createBlank")}
            </button>
            <button
              type="button"
              onClick={saveCurrentPageAsTemplate}
              disabled={saving || selectedBlock?.type !== "page"}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
            >
              {t("templates.saveCurrent")}
            </button>
          </div>

          {message && (
            <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
              {message}
            </p>
          )}

          <div className="mt-5 max-h-72 space-y-2 overflow-y-auto">
            {loading && (
              <p className="text-sm text-zinc-500">{t("templates.loading")}</p>
            )}
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800">
                    {template.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {template.description || template.blockType}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void instantiate(template)}
                  className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700"
                >
                  {t("templates.use")}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(template.id)}
                  className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  {t("common.delete")}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t("templates.deleteTitle")}
        message={t("templates.deleteMessage")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={confirmDeleteTemplate}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}
