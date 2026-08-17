"use client";

import { type JSONContent } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import {
  Details,
  DetailsContent,
  DetailsSummary
} from "@tiptap/extension-details";
import {
  Table,
  TableRow,
  TableHeader,
  TableCell
} from "@tiptap/extension-table";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Callout } from "@/lib/callout";
import { Embed } from "@/lib/embed";
import { ButtonBlock } from "@/lib/button_block";
import { SyncedBlock } from "@/lib/synced_block";
import { EquationBlock } from "@/lib/equation_block";
import { Columns, Column } from "@/lib/columns";
import { NumberChart } from "@/lib/number_chart";
import { ChartBlock } from "@/lib/chart_block";

export default function ReadOnlyEditor({
  content
}: {
  content?: JSONContent;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    content,
    editable: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem,
      Image.configure({ allowBase64: true }),
      Details,
      DetailsContent,
      DetailsSummary,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Callout,
      Embed,
      ButtonBlock,
      SyncedBlock,
      EquationBlock,
      Columns,
      Column,
      NumberChart,
      ChartBlock
    ]
  });

  return (
    <div data-block-editor>
      <EditorContent editor={editor} className="block-editor" />
    </div>
  );
}
