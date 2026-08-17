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

  const cover =
    typeof block.properties.cover === "string" ? block.properties.cover : "";
  const icon =
    typeof block.properties.icon === "string" ? block.properties.icon : "";

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 flex h-11 items-center justify-between border-b border-zinc-100 bg-white/90 px-4 backdrop-blur">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">
          {block.properties.title || t("editor.placeholder")}
        </span>
        <span className="text-xs text-zinc-400">{t("shared.badge")}</span>
      </header>

      {cover ? (
        <div className="relative mx-auto mb-14 h-70">
          <div className="absolute inset-0 overflow-hidden bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="relative mx-auto h-full w-[720px] max-w-full">
            {icon ? (
              <div className="absolute -bottom-[51px] left-0 flex h-[102px] w-[78px] items-center justify-center text-[78px] leading-none">
                {icon}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-[720px] max-w-full">
        {!cover && icon ? (
          <div className="mb-3 flex h-[102px] w-[78px] items-center justify-center text-[78px] leading-none">
            {icon}
          </div>
        ) : null}
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          {block.properties.title || t("editor.placeholder")}
        </h1>

        <div className="mt-8">
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
