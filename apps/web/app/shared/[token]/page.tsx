"use client";

import { type JSONContent } from "@tiptap/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReadOnlyEditor from "@/components/ReadOnlyEditor";
import { apiFetch, Block, Share } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { normalizeLegacyMarkdownDocument } from "@/lib/markdown";

export default function SharedPage() {
  const params = useParams<{ token: string }>();
  const { t } = useI18n();
  const token = params?.token ?? "";
  const [block, setBlock] = useState<Block | null>(null);
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiFetch<{ block: Block; share: Share }>(`/api/shares/${token}`)
      .then((result) => {
        setBlock(result.block);
        setShare(result.share);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("shared.error")
        );
      });
  }, [t, token]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-8">
        <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">
            {t("shared.unavailable")}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">{error}</p>
        </div>
      </main>
    );
  }

  if (!block || !share) {
    return <main className="min-h-screen bg-zinc-50" />;
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {t("shared.badge")}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
          {block.properties.title || t("editor.placeholder")}
        </h1>

        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <ReadOnlyEditor
            content={normalizeDocument(block.properties.content)}
          />
        </div>
      </div>
    </main>
  );
}

function normalizeDocument(value: unknown): JSONContent | undefined {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type?: unknown }).type === "doc"
  ) {
    return normalizeLegacyMarkdownDocument(value as JSONContent);
  }
  return undefined;
}
