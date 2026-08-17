"use client";

import { useEffect, useState } from "react";
import { apiFetch, SearchResult } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type SearchDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
};

export default function SearchDialog({
  open,
  onClose,
  onSelect
}: SearchDialogProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      apiFetch<{ results: SearchResult[] }>(
        `/api/search?q=${encodeURIComponent(trimmedQuery)}`
      )
        .then((result) => {
          setResults(result.results);
          setError(null);
        })
        .catch((searchError) => {
          setResults([]);
          setError(
            searchError instanceof Error
              ? searchError.message
              : t("search.failed")
          );
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [open, query, t]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 p-4 pt-24"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="border-b border-zinc-100 p-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full border-0 px-2 py-1 text-lg outline-none"
          />
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() && loading && <p className="p-4 text-sm text-zinc-500">{t("search.searching")}</p>}
          {query.trim() && error && <p className="p-4 text-sm text-red-600">{error}</p>}
          {query.trim() && !loading && !error && results.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">{t("search.noResults")}</p>
          )}

          {query.trim() && results.map((result) => (
            <button
              key={`${result.workspaceId}-${result.blockId}`}
              type="button"
              onClick={() => onSelect(result)}
              className="w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-100"
            >
              <span className="block text-sm font-medium text-zinc-900">
                {result.title || "Untitled"}
              </span>
              <span className="block text-xs text-zinc-500">
                {result.type}
                {result.snippet ? ` · ${result.snippet}` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
