"use client";

import { DragEvent, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  Plus,
  Trash2
} from "lucide-react";
import { BlockNode } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type PageTreeProps = {
  nodes: BlockNode[];
  selectedId: string | null;
  onSelect: (block: BlockNode) => void;
  onCreateChild: (parentId: string | null) => void;
  onCreateDatabase: (parentId: string | null) => void;
  onDelete: (blockId: string) => void;
  onMove: (
    blockId: string,
    parentId: string | null,
    position: number,
    clearParent: boolean
  ) => void;
};

type TreeItemProps = PageTreeProps & {
  node: BlockNode;
  level: number;
  expanded: Record<string, boolean>;
  onToggle: (blockId: string) => void;
};

export default function PageTree({
  nodes,
  selectedId,
  onSelect,
  onCreateChild,
  onCreateDatabase,
  onDelete,
  onMove
}: PageTreeProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(blockId: string) {
    setExpanded((current) => ({
      ...current,
      [blockId]: !current[blockId]
    }));
  }

  if (nodes.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-zinc-500">
        {t("tree.noPages")}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          nodes={nodes}
          node={node}
          level={0}
          expanded={expanded}
          onToggle={toggle}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onCreateDatabase={onCreateDatabase}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

function TreeItem({
  node,
  level,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  onCreateChild,
  onCreateDatabase,
  onDelete,
  onMove
}: TreeItemProps) {
  const { t } = useI18n();
  const isExpanded = expanded[node.id] !== false;
  const hasChildren = node.children.length > 0;

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData("text/plain", node.id);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const blockId = event.dataTransfer.getData("text/plain");
    if (!blockId || blockId === node.id) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;

    if (event.altKey) {
      onMove(blockId, node.id, 0, false);
      return;
    }

    onMove(
      blockId,
      node.parentId,
      before ? node.position : node.position + 1,
      node.parentId === null
    );
  }

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onClick={() => onSelect(node)}
        style={{ paddingLeft: `${level * 14}px` }}
        className={`group flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 text-sm ${
          selectedId === node.id
            ? "bg-zinc-200 text-zinc-900"
            : "text-zinc-700 hover:bg-zinc-100"
        }`}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.id);
          }}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400 ${
            hasChildren ? "" : "invisible"
          }`}
          aria-label={isExpanded ? t("tree.collapse") : t("tree.expand")}
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        <span className="min-w-0 flex-1 truncate">
          {node.type === "database" && (
            <Database size={13} className="mr-1 inline" />
          )}
          {node.properties.title || t("editor.placeholder")}
        </span>

        <div
          className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCreateChild(node.id);
            }}
            className="rounded px-1 text-zinc-400 hover:bg-zinc-200"
            aria-label={t("tree.addChildPage")}
          >
            <Plus size={13} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCreateDatabase(node.id);
            }}
            className="rounded px-1 text-zinc-400 hover:bg-zinc-200"
            aria-label={t("tree.addChildDatabase")}
          >
            <Database size={13} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(node.id);
            }}
            className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
            aria-label={t("tree.deletePage")}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              nodes={node.children}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onCreateDatabase={onCreateDatabase}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
