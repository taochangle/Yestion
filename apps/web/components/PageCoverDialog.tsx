"use client";

import {
  type ChangeEvent as ReactChangeEvent,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Image as ImageIcon,
  Link as LinkIcon,
  Search,
  Upload
} from "lucide-react";
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

type CoverTab = "unsplash" | "upload" | "link";

type PageCoverDialogProps = {
  open: boolean;
  coverUrl: string;
  onClose: () => void;
  onSelect: (coverUrl: string) => void;
  onRemove: () => void;
  onUploadImage: (file: File) => Promise<string>;
};

export const UNSPLASH_COVERS = [
  {
    label: "Office",
    url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&h=400&fit=crop"
  },
  {
    label: "Nature",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&h=400&fit=crop"
  },
  {
    label: "Mountain",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&h=400&fit=crop"
  },
  {
    label: "Travel",
    url: "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=1600&h=400&fit=crop"
  },
  {
    label: "Forest",
    url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&h=400&fit=crop"
  },
  {
    label: "City",
    url: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1600&h=400&fit=crop"
  },
  {
    label: "Landscape",
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&h=400&fit=crop"
  },
  {
    label: "Water",
    url: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1600&h=400&fit=crop"
  },
  {
    label: "Abstract",
    url: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1600&h=400&fit=crop"
  },
  {
    label: "Desert",
    url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1600&h=400&fit=crop"
  },
  {
    label: "Plants",
    url: "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?w=1600&h=400&fit=crop"
  },
  {
    label: "Sky",
    url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&h=400&fit=crop"
  }
];

export default function PageCoverDialog({
  open,
  coverUrl,
  onClose,
  onSelect,
  onRemove,
  onUploadImage
}: PageCoverDialogProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<CoverTab>("unsplash");
  const [query, setQuery] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredCovers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return UNSPLASH_COVERS;
    }
    return UNSPLASH_COVERS.filter((cover) =>
      cover.label.toLowerCase().includes(normalized)
    );
  }, [query]);

  async function handleUpload(event: ReactChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const url = await onUploadImage(file);
      onSelect(url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("cover.title")}</DialogTitle>
          <DialogDescription>{t("cover.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b pb-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTab("unsplash")}
            className={tab === "unsplash" ? "bg-zinc-100" : ""}
          >
            <ImageIcon />
            Unsplash
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTab("upload")}
            className={tab === "upload" ? "bg-zinc-100" : ""}
          >
            <Upload />
            {t("cover.upload")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTab("link")}
            className={tab === "link" ? "bg-zinc-100" : ""}
          >
            <LinkIcon />
            {t("cover.link")}
          </Button>

          {coverUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto text-red-600 hover:text-red-600"
              onClick={onRemove}
            >
              {t("cover.remove")}
            </Button>
          ) : null}
        </div>

        {tab === "unsplash" ? (
          <>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("cover.searchPlaceholder")}
                className="pl-8"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {filteredCovers.map((cover) => (
                <button
                  key={cover.url}
                  type="button"
                  onClick={() => onSelect(cover.url)}
                  className="group overflow-hidden rounded-md border border-zinc-200 text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover.url}
                    alt={cover.label}
                    className="h-20 w-full object-cover transition-transform group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </>
        ) : null}

        {tab === "upload" ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <Upload size={18} />
            {uploading ? t("common.loading") : t("cover.upload")}
          </button>
        ) : null}

        {tab === "link" ? (
          <div className="flex items-center gap-2">
            <Input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://..."
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              onClick={() => {
                const url = linkUrl.trim();
                if (url) {
                  onSelect(url);
                }
              }}
              disabled={!linkUrl.trim()}
            >
              {t("cover.useLink")}
            </Button>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </DialogContent>
    </Dialog>
  );
}
