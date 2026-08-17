"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BlockNode } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type MovePageDialogProps = {
  blocks: BlockNode[];
  selectedBlockId: string;
  onClose: () => void;
  onMove: (parentId: string) => Promise<void>;
};

export default function MovePageDialog({
  blocks,
  selectedBlockId,
  onClose,
  onMove
}: MovePageDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("move.title")}</DialogTitle>
          <DialogDescription>{t("move.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => void onMove("")}
          >
            {t("move.root")}
          </Button>
          {blocks.map((block) => (
            <MoveNode
              key={block.id}
              node={block}
              level={0}
              selectedBlockId={selectedBlockId}
              onMove={onMove}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MoveNode({
  node,
  level,
  selectedBlockId,
  onMove
}: {
  node: BlockNode;
  level: number;
  selectedBlockId: string;
  onMove: (parentId: string) => Promise<void>;
}) {
  const disabled = node.id === selectedBlockId;

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        className="w-full justify-start"
        style={{ paddingLeft: `${12 + level * 14}px` }}
        onClick={() => void onMove(node.id)}
      >
        {node.properties.title || "Untitled"}
      </Button>
      {node.children.map((child) => (
        <MoveNode
          key={child.id}
          node={child}
          level={level + 1}
          selectedBlockId={selectedBlockId}
          onMove={onMove}
        />
      ))}
    </div>
  );
}
