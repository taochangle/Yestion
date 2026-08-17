"use client";

import {
  EditorContent,
  type Editor,
  type JSONContent,
  useEditor
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import DragHandle from "@tiptap/extension-drag-handle";
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
import {
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Callout } from "@/lib/callout";
import { Embed } from "@/lib/embed";
import { ButtonBlock } from "@/lib/button_block";
import { SyncedBlock } from "@/lib/synced_block";
import { EquationBlock } from "@/lib/equation_block";
import { Columns, Column } from "@/lib/columns";
import { NumberChart } from "@/lib/number_chart";
import { ChartBlock } from "@/lib/chart_block";
import { BreadcrumbItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

type SlashCommand = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  category: string;
  run: (editor: Editor) => void;
};

type SlashCommandDefinition = Omit<SlashCommand, "category">;

type SlashMenuState = {
  open: boolean;
  query: string;
  from: number;
  to: number;
  top: number;
  left: number;
  selectedIndex: number;
};

type ToolbarState = {
  open: boolean;
  top: number;
  left: number;
  activeType: string;
  selectedIndex: number;
};

type BlockEditorProps = {
  blockId: string;
  initialDocument?: JSONContent;
  breadcrumb?: BreadcrumbItem[];
  onDocumentChange: (document: JSONContent) => void;
  onUploadImage: (file: File) => Promise<string>;
  onUploadFile: (file: File) => Promise<string>;
};

const emptyMenu: SlashMenuState = {
  open: false,
  query: "",
  from: 0,
  to: 0,
  top: 0,
  left: 0,
  selectedIndex: 0
};

const emptyToolbar: ToolbarState = {
  open: false,
  top: 0,
  left: 0,
  activeType: "paragraph",
  selectedIndex: 0
};

export default function BlockEditor({
  blockId,
  initialDocument,
  breadcrumb = [],
  onDocumentChange,
  onUploadImage,
  onUploadFile
}: BlockEditorProps) {
  const { t } = useI18n();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingEmbedTypeRef = useRef<"video" | "audio" | "file">("file");
  const documentChangeRef = useRef(onDocumentChange);
  const imageUploadRef = useRef(onUploadImage);
  const fileUploadRef = useRef(onUploadFile);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>(emptyMenu);
  const [toolbar, setToolbar] = useState<ToolbarState>(emptyToolbar);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [bookmarkUrl, setBookmarkUrl] = useState("");
  const [bookmarkTitle, setBookmarkTitle] = useState("");
  const [bookmarkDescription, setBookmarkDescription] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [buttonOpen, setButtonOpen] = useState(false);
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [buttonColor, setButtonColor] = useState("default");
  const [equationOpen, setEquationOpen] = useState(false);
  const [equationExpression, setEquationExpression] = useState("");
  const [numberChartOpen, setNumberChartOpen] = useState(false);
  const [numberChartLabel, setNumberChartLabel] = useState("");
  const [numberChartValue, setNumberChartValue] = useState("");
  const [chartOpen, setChartOpen] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "line" | "donut">("bar");
  const [chartData, setChartData] = useState("");

  useEffect(() => {
    documentChangeRef.current = onDocumentChange;
    imageUploadRef.current = onUploadImage;
    fileUploadRef.current = onUploadFile;
  });

  const updateSlashMenu = useCallback((editor: Editor) => {
    const { empty, from, $from } = editor.state.selection;

    if (!empty || $from.parent.type.name === "codeBlock") {
      setSlashMenu((current) =>
        current.open ? { ...current, open: false } : current
      );
      return;
    }

    const textBefore = $from.parent.textBetween(
      0,
      $from.parentOffset,
      undefined,
      "\n"
    );
    const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);

    if (!match) {
      setSlashMenu((current) =>
        current.open ? { ...current, open: false } : current
      );
      return;
    }

    const rangeStart = from - (match[1]?.length ?? 0) - 1;
    const coordinates = editor.view.coordsAtPos(rangeStart);

    setSlashMenu({
      open: true,
      query: match[1] ?? "",
      from: rangeStart,
      to: from,
      top: coordinates.bottom + 4,
      left: coordinates.left,
      selectedIndex: 0
    });
  }, []);

  const updateToolbar = useCallback((editor: Editor) => {
    const { empty, from } = editor.state.selection;

    if (empty) {
      setToolbar((current) =>
        current.open ? { ...current, open: false } : current
      );
      return;
    }

    const coordinates = editor.view.coordsAtPos(from);

    setToolbar({
      open: true,
      top: coordinates.bottom + 4,
      left: coordinates.left,
      activeType: getActiveBlockType(editor),
      selectedIndex: 0
    });
  }, []);

  const handleEditorUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      documentChangeRef.current(editor.getJSON());
      updateSlashMenu(editor);
      updateToolbar(editor);
    },
    [updateSlashMenu, updateToolbar]
  );

  const openImagePicker = useCallback(() => {
    setSlashMenu((current) =>
      current.open ? { ...current, open: false } : current
    );
    imageInputRef.current?.click();
  }, []);

  function openFilePicker(embedType: "video" | "audio" | "file") {
    pendingEmbedTypeRef.current = embedType;
    setSlashMenu((current) =>
      current.open ? { ...current, open: false } : current
    );
    fileInputRef.current?.click();
  }

  function openBookmarkDialog() {
    setSlashMenu((current) =>
      current.open ? { ...current, open: false } : current
    );
    setBookmarkOpen(true);
  }

  function insertBookmark() {
    if (!editor || !bookmarkUrl.trim()) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "embed",
        attrs: {
          src: bookmarkUrl.trim(),
          embedType: "bookmark",
          title: bookmarkTitle.trim() || bookmarkUrl.trim(),
          description: bookmarkDescription.trim()
        }
      })
      .run();

    setBookmarkOpen(false);
    setBookmarkUrl("");
    setBookmarkTitle("");
    setBookmarkDescription("");
  }

  function openLinkDialog() {
    setSlashMenu((current) =>
      current.open ? { ...current, open: false } : current
    );
    setLinkOpen(true);
  }

  function insertLink() {
    if (!editor || !linkUrl.trim()) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text: linkText.trim() || linkUrl.trim(),
        marks: [
          {
            type: "link",
            attrs: {
              href: linkUrl.trim(),
              target: "_blank",
              rel: "noopener noreferrer"
            }
          }
        ]
      })
      .run();

    setLinkOpen(false);
    setLinkUrl("");
    setLinkText("");
  }

  function openButtonDialog() {
    setSlashMenu((current) =>
      current.open ? { ...current, open: false } : current
    );
    setButtonOpen(true);
  }

  function insertButtonBlock() {
    if (!editor || !buttonLabel.trim()) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "buttonBlock",
        attrs: {
          label: buttonLabel.trim(),
          url: buttonUrl.trim() || "#",
          color: buttonColor
        }
      })
      .run();

    setButtonOpen(false);
    setButtonLabel("");
    setButtonUrl("");
    setButtonColor("default");
  }

  function openEquationDialog() {
    setSlashMenu((current) =>
      current.open ? { ...current, open: false } : current
    );
    setEquationOpen(true);
  }

  function insertEquationBlock() {
    if (!editor || !equationExpression.trim()) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "equationBlock",
        attrs: { expression: equationExpression.trim() }
      })
      .run();

    setEquationOpen(false);
    setEquationExpression("");
  }

  function openNumberChartDialog() {
    setSlashMenu((current) =>
      current.open ? { ...current, open: false } : current
    );
    setNumberChartOpen(true);
  }

  function insertNumberChart() {
    if (!editor || !numberChartValue.trim()) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "numberChart",
        attrs: {
          label: numberChartLabel.trim(),
          value: numberChartValue.trim(),
          color: "blue"
        }
      })
      .run();

    setNumberChartOpen(false);
    setNumberChartLabel("");
    setNumberChartValue("");
  }

  function openChartDialog(type: "bar" | "line" | "donut") {
    setChartType(type);
    setChartOpen(true);
    setSlashMenu((current) =>
      current.open ? { ...current, open: false } : current
    );
  }

  function insertChartBlock() {
    if (!editor || !chartData.trim()) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "chartBlock",
        attrs: {
          chartType,
          data: chartData.trim(),
          labels: ""
        }
      })
      .run();

    setChartOpen(false);
    setChartData("");
  }


  const editor = useEditor(
    {
      immediatelyRender: false,
      content: initialDocument,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4]
          },
          codeBlock: {
            HTMLAttributes: {
              class: "block-code"
            }
          }
        }),
        Placeholder.configure({
          placeholder: t("editor.placeholder")
        }),
        TaskList,
        TaskItem.configure({
          nested: true
        }),
        Image.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: {
            class: "block-image"
          }
        }),
        DragHandle.configure({
          nested: true,
          render() {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "block-drag-handle";
            button.textContent = "⠿";
            button.setAttribute("aria-label", "Drag block");
            return button;
          }
        }),
        Details.configure({
          persist: true,
          renderToggleButton: ({ element, isOpen }) => {
            element.textContent = isOpen ? "▾" : "▸";
            element.setAttribute(
              "aria-label",
              isOpen ? "Collapse details" : "Expand details"
            );
          }
        }),
        DetailsContent,
        DetailsSummary,
        Table.configure({
          resizable: true
        }),
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
      ],
      onUpdate: handleEditorUpdate,
      onSelectionUpdate: handleEditorUpdate
    },
    [blockId, handleEditorUpdate, t]
  );

  const commands = useMemo(
    () => (editor ? getSlashCommands(editor, breadcrumb) : []),
    [breadcrumb, editor]
  );

  const filteredCommands = useMemo(() => {
    const query = slashMenu.query.trim().toLowerCase();
    if (!query) {
      return commands;
    }

    return commands.filter((command) => {
      const haystack = [
        command.label,
        command.description,
        ...command.keywords
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [commands, slashMenu.query]);

  function applyBlockType(type: string) {
    if (!editor) {
      return;
    }

    const chain = editor.chain().focus();

    switch (type) {
      case "heading1":
        chain.toggleHeading({ level: 1 as const });
        break;
      case "heading2":
        chain.toggleHeading({ level: 2 as const });
        break;
      case "heading3":
        chain.toggleHeading({ level: 3 as const });
        break;
      case "heading4":
        chain.toggleHeading({ level: 4 as const });
        break;
      case "bulletList":
        chain.toggleBulletList();
        break;
      case "orderedList":
        chain.toggleOrderedList();
        break;
      case "taskList":
        chain.toggleTaskList();
        break;
      case "blockquote":
        chain.toggleBlockquote();
        break;
      case "codeBlock":
        chain.toggleCodeBlock();
        break;
      case "details":
        chain.setDetails();
        break;
      case "divider":
        chain.setHorizontalRule();
        break;
      case "table":
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
        break;
      case "callout":
        chain.setCallout({ color: "gray", emoji: "💡" });
        break;
      case "synced":
        chain.setSyncedBlock();
        break;
      default:
        chain.setParagraph();
    }

    chain.run();
    setToolbar((current) => ({ ...current, open: false }));
  }

  function setTextColor(color: string) {
    if (!editor) {
      return;
    }
    editor.chain().focus().setColor(color).run();
  }

  function setBackgroundColor(color: string) {
    if (!editor) {
      return;
    }
    editor.chain().focus().toggleHighlight({ color }).run();
  }

  async function handleImageInputChange(
    event: ReactChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !editor) {
      return;
    }

    const from = editor.state.selection.from;
    setUploadError(null);

    try {
      const src = await imageUploadRef.current(file);
      editor
        .chain()
        .focus()
        .insertContentAt(from, {
          type: "image",
          attrs: { src, alt: file.name }
        })
        .run();
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Image upload failed"
      );
    }
  }

  async function handleFileInputChange(
    event: ReactChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !editor) {
      return;
    }

    const from = editor.state.selection.from;
    setUploadError(null);

    try {
      const src = await fileUploadRef.current(file);
      editor
        .chain()
        .focus()
        .insertContentAt(from, {
          type: "embed",
          attrs: {
            src,
            embedType: pendingEmbedTypeRef.current,
            title: file.name
          }
        })
        .run();
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "File upload failed"
      );
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!editor) {
      return;
    }

    if (slashMenu.open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashMenu((current) => ({
          ...current,
          selectedIndex: Math.min(
            current.selectedIndex + 1,
            filteredCommands.length - 1
          )
        }));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashMenu((current) => ({
          ...current,
          selectedIndex: Math.max(current.selectedIndex - 1, 0)
        }));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const command = filteredCommands[slashMenu.selectedIndex];
        if (command) {
          editor
            .chain()
            .focus()
            .deleteRange({ from: slashMenu.from, to: slashMenu.to })
            .run();
          if (command.id === "image") {
            openImagePicker();
          } else if (
            command.id === "video" ||
            command.id === "audio" ||
            command.id === "file"
          ) {
            openFilePicker(command.id as "video" | "audio" | "file");
          } else if (command.id === "bookmark") {
            openBookmarkDialog();
          } else if (command.id === "link") {
            openLinkDialog();
          } else if (command.id === "button") {
            openButtonDialog();
          } else if (command.id === "equation") {
            openEquationDialog();
          } else if (command.id === "numberchart") {
            openNumberChartDialog();
          } else if (command.id === "bar") {
            openChartDialog("bar");
          } else if (command.id === "line") {
            openChartDialog("line");
          } else if (command.id === "donut") {
            openChartDialog("donut");
          } else {
            command.run(editor);
          }
        }
        setSlashMenu((current) => ({ ...current, open: false }));
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSlashMenu((current) => ({ ...current, open: false }));
        return;
      }
    }

    if (toolbar.open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setToolbar((current) => ({
          ...current,
          selectedIndex: Math.min(
            current.selectedIndex + 1,
            filteredCommands.length - 1
          )
        }));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setToolbar((current) => ({
          ...current,
          selectedIndex: Math.max(current.selectedIndex - 1, 0)
        }));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const command = filteredCommands[toolbar.selectedIndex];
        if (command) {
          if (command.id === "image") {
            openImagePicker();
          } else if (
            command.id === "video" ||
            command.id === "audio" ||
            command.id === "file"
          ) {
            openFilePicker(command.id as "video" | "audio" | "file");
          } else if (command.id === "bookmark") {
            openBookmarkDialog();
          } else if (command.id === "link") {
            openLinkDialog();
          } else if (command.id === "button") {
            openButtonDialog();
          } else if (command.id === "equation") {
            openEquationDialog();
          } else {
            command.run(editor);
          }
        }
        setToolbar((current) => ({ ...current, open: false }));
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setToolbar((current) => ({ ...current, open: false }));
        return;
      }
    }

    if (event.key === "Tab" && editor.isActive("listItem")) {
      event.preventDefault();
      if (event.shiftKey) {
        editor.chain().focus().liftListItem("listItem").run();
      } else {
        editor.chain().focus().sinkListItem("listItem").run();
      }
    }
  }

  return (
    <div className="relative">
      {uploadError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {uploadError}
        </p>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageInputChange}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,.pdf,.zip,.txt,.md,.csv,.json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div data-block-editor>
        <EditorContent
          editor={editor}
          className="block-editor"
          onKeyDown={handleKeyDown}
        />
      </div>

      {slashMenu.open && editor && (
        <SlashMenu
          menu={slashMenu}
          commands={filteredCommands}
          onHover={(index) =>
            setSlashMenu((current) => ({ ...current, selectedIndex: index }))
          }
          onSelect={(command) => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: slashMenu.from, to: slashMenu.to })
              .run();
            if (command.id === "image") {
              openImagePicker();
            } else if (
              command.id === "video" ||
              command.id === "audio" ||
              command.id === "file"
            ) {
              openFilePicker(command.id as "video" | "audio" | "file");
            } else if (command.id === "bookmark") {
              openBookmarkDialog();
            } else if (command.id === "link") {
              openLinkDialog();
            } else if (command.id === "button") {
              openButtonDialog();
            } else if (command.id === "equation") {
              openEquationDialog();
            } else if (command.id === "numberchart") {
              openNumberChartDialog();
            } else if (command.id === "bar") {
              openChartDialog("bar");
            } else if (command.id === "line") {
              openChartDialog("line");
            } else if (command.id === "donut") {
              openChartDialog("donut");
            } else {
              command.run(editor);
            }
            setSlashMenu((current) => ({ ...current, open: false }));
          }}
        />
      )}

      {toolbar.open && editor && (
        <SlashMenu
          menu={{
            open: true,
            query: "",
            from: 0,
            to: 0,
            top: toolbar.top,
            left: toolbar.left,
            selectedIndex: toolbar.selectedIndex
          }}
          commands={commands}
          onHover={(index) =>
            setToolbar((current) => ({ ...current, selectedIndex: index }))
          }
          onSelect={(command) => {
            if (command.id === "image") {
              openImagePicker();
            } else if (
              command.id === "video" ||
              command.id === "audio" ||
              command.id === "file"
            ) {
              openFilePicker(command.id as "video" | "audio" | "file");
            } else if (command.id === "bookmark") {
              openBookmarkDialog();
            } else if (command.id === "link") {
              openLinkDialog();
            } else if (command.id === "button") {
              openButtonDialog();
            } else if (command.id === "equation") {
              openEquationDialog();
            } else if (command.id === "numberchart") {
              openNumberChartDialog();
            } else if (command.id === "bar") {
              openChartDialog("bar");
            } else if (command.id === "line") {
              openChartDialog("line");
            } else if (command.id === "donut") {
              openChartDialog("donut");
            } else {
              command.run(editor);
            }
            setToolbar((current) => ({ ...current, open: false }));
          }}
        />
      )}

      <Dialog open={bookmarkOpen} onOpenChange={setBookmarkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Web bookmark</DialogTitle>
            <DialogDescription>
              Add a link card to the page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bookmark-url">URL</Label>
              <Input
                id="bookmark-url"
                value={bookmarkUrl}
                onChange={(event) => setBookmarkUrl(event.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bookmark-title">Title</Label>
              <Input
                id="bookmark-title"
                value={bookmarkTitle}
                onChange={(event) => setBookmarkTitle(event.target.value)}
                placeholder="Link title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bookmark-description">Description</Label>
              <Input
                id="bookmark-description"
                value={bookmarkDescription}
                onChange={(event) =>
                  setBookmarkDescription(event.target.value)
                }
                placeholder="Short description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookmarkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertBookmark}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to page</DialogTitle>
            <DialogDescription>
              Insert a link with optional display text.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="link-text">Text</Label>
              <Input
                id="link-text"
                value={linkText}
                onChange={(event) => setLinkText(event.target.value)}
                placeholder="Display text"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertLink}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={buttonOpen} onOpenChange={setButtonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Button</DialogTitle>
            <DialogDescription>
              Insert a clickable button.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="button-label">Label</Label>
              <Input
                id="button-label"
                value={buttonLabel}
                onChange={(event) => setButtonLabel(event.target.value)}
                placeholder="Button text"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="button-url">URL</Label>
              <Input
                id="button-url"
                value={buttonUrl}
                onChange={(event) => setButtonUrl(event.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="button-color">Color</Label>
              <select
                id="button-color"
                value={buttonColor}
                onChange={(event) => setButtonColor(event.target.value)}
                className="w-full rounded-md border p-2 text-sm"
              >
                <option value="default">Default</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="red">Red</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setButtonOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertButtonBlock}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={equationOpen} onOpenChange={setEquationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block equation</DialogTitle>
            <DialogDescription>
              Enter a math expression or LaTeX.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={equationExpression}
            onChange={(event) => setEquationExpression(event.target.value)}
            placeholder="E = mc^2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertEquationBlock}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={numberChartOpen} onOpenChange={setNumberChartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Number chart</DialogTitle>
            <DialogDescription>
              Insert a numeric metric card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="number-chart-value">Value</Label>
              <Input
                id="number-chart-value"
                value={numberChartValue}
                onChange={(event) => setNumberChartValue(event.target.value)}
                placeholder="42"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="number-chart-label">Label</Label>
              <Input
                id="number-chart-label"
                value={numberChartLabel}
                onChange={(event) => setNumberChartLabel(event.target.value)}
                placeholder="Completed tasks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNumberChartOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertNumberChart}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chartOpen} onOpenChange={setChartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chart</DialogTitle>
            <DialogDescription>
              Enter comma-separated numeric values.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={chartData}
            onChange={(event) => setChartData(event.target.value)}
            placeholder="10, 20, 30, 40"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChartOpen(false)}>
              Cancel
            </Button>
            <Button onClick={insertChartBlock}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SlashMenu({
  menu,
  commands,
  onHover,
  onSelect
}: {
  menu: SlashMenuState;
  commands: SlashCommand[];
  onHover: (index: number) => void;
  onSelect: (command: SlashCommand) => void;
}) {
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const groupedCommands = useMemo(() => {
    const groups = new Map<string, SlashCommand[]>();
    for (const command of commands) {
      const list = groups.get(command.category) ?? [];
      list.push(command);
      groups.set(command.category, list);
    }
    return Array.from(groups.entries()).sort(
      (a, b) =>
        commandCategoryOrder.indexOf(a[0]) -
        commandCategoryOrder.indexOf(b[0])
    );
  }, [commands]);

  useEffect(() => {
    const command = commands[menu.selectedIndex];
    if (command) {
      itemRefs.current[command.id]?.scrollIntoView({ block: "nearest" });
    }
  }, [commands, menu.selectedIndex]);

  if (commands.length === 0) {
    return (
      <div
        className="fixed z-40 w-64 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-500 shadow-xl"
        style={{ top: menu.top, left: menu.left }}
      >
        No matching blocks.
      </div>
    );
  }

  return (
    <div
      className="fixed z-40 max-h-80 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl"
      style={{ top: menu.top, left: menu.left }}
    >
      {groupedCommands.map(([category, categoryCommands]) => {
        return (
          <div key={category}>
            <p className="px-2 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              {category}
            </p>
            {categoryCommands.map((command) => {
              const index = commands.findIndex((item) => item.id === command.id);
              return (
                <button
                  key={command.id}
                  ref={(element) => {
                    itemRefs.current[command.id] = element;
                  }}
                  type="button"
                  onMouseEnter={() => onHover(index)}
                  onClick={() => onSelect(command)}
                  className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left ${
                    index === menu.selectedIndex ? "bg-zinc-100" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-900">
                      {command.label}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {command.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function getSlashCommands(
  editor: Editor,
  breadcrumb: BreadcrumbItem[]
): SlashCommand[] {
  const commandDefinitions: SlashCommandDefinition[] = [
    {
      id: "paragraph",
      label: "Text",
      description: "Plain paragraph",
      keywords: ["text", "paragraph", "body"],
      run: (currentEditor) =>
        currentEditor.chain().focus().setParagraph().run()
    },
    {
      id: "heading1",
      label: "Heading 1",
      description: "Large section heading",
      keywords: ["heading", "h1", "title"],
      run: (currentEditor) =>
        currentEditor.chain().focus().toggleHeading({ level: 1 as const }).run()
    },
    {
      id: "heading2",
      label: "Heading 2",
      description: "Medium section heading",
      keywords: ["heading", "h2"],
      run: (currentEditor) =>
        currentEditor.chain().focus().toggleHeading({ level: 2 as const }).run()
    },
    {
      id: "heading3",
      label: "Heading 3",
      description: "Small section heading",
      keywords: ["heading", "h3"],
      run: (currentEditor) =>
        currentEditor.chain().focus().toggleHeading({ level: 3 as const }).run()
    },
    {
      id: "heading4",
      label: "Heading 4",
      description: "Small section heading",
      keywords: ["heading", "h4"],
      run: (currentEditor) =>
        currentEditor.chain().focus().toggleHeading({ level: 4 as const }).run()
    },
    {
      id: "bulletList",
      label: "Bullet list",
      description: "Unordered list",
      keywords: ["bullet", "list", "unordered"],
      run: (currentEditor) =>
        currentEditor.chain().focus().toggleBulletList().run()
    },
    {
      id: "orderedList",
      label: "Numbered list",
      description: "Ordered list",
      keywords: ["numbered", "ordered", "list", "1"],
      run: (currentEditor) =>
        currentEditor.chain().focus().toggleOrderedList().run()
    },
    {
      id: "taskList",
      label: "To-do list",
      description: "Track tasks with checkboxes",
      keywords: ["task", "todo", "checklist", "checkbox"],
      run: (currentEditor) =>
        currentEditor.chain().focus().toggleTaskList().run()
    },
    {
      id: "blockquote",
      label: "Quote",
      description: "Capture a quotation",
      keywords: ["quote", "blockquote"],
      run: (currentEditor) =>
        currentEditor.chain().focus().toggleBlockquote().run()
    },
    {
      id: "codeBlock",
      label: "Code block",
      description: "Capture a code snippet",
      keywords: ["code", "codeblock", "snippet"],
      run: (currentEditor) =>
        currentEditor.chain().focus().toggleCodeBlock().run()
    },
    {
      id: "details",
      label: "Toggle list",
      description: "Collapsible toggle section",
      keywords: ["details", "fold", "collapse", "toggle"],
      run: (currentEditor) => currentEditor.chain().focus().setDetails().run()
    },
    {
      id: "callout",
      label: "Callout",
      description: "Highlighted note or tip",
      keywords: ["callout", "note", "tip", "highlight"],
      run: (currentEditor) =>
        currentEditor
          .chain()
          .focus()
          .setCallout({ color: "gray", emoji: "💡" })
          .run()
    },
    {
      id: "divider",
      label: "Divider",
      description: "Horizontal line",
      keywords: ["divider", "line", "separator", "---"],
      run: (currentEditor) =>
        currentEditor.chain().focus().setHorizontalRule().run()
    },
    {
      id: "table",
      label: "Table",
      description: "Insert a table",
      keywords: ["table", "grid", "columns"],
      run: (currentEditor) =>
        currentEditor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run()
    },
    {
      id: "image",
      label: "Image",
      description: "Upload an image to MinIO",
      keywords: ["image", "picture", "photo", "upload"],
      run: () => undefined
    },
    {
      id: "video",
      label: "Video",
      description: "Upload a video",
      keywords: ["video", "movie", "mp4", "upload"],
      run: () => undefined
    },
    {
      id: "audio",
      label: "Audio",
      description: "Upload an audio file",
      keywords: ["audio", "music", "mp3", "sound"],
      run: () => undefined
    },
    {
      id: "file",
      label: "File",
      description: "Upload a file attachment",
      keywords: ["file", "document", "pdf", "attachment"],
      run: () => undefined
    },
    {
      id: "bookmark",
      label: "Web bookmark",
      description: "Embed a link card",
      keywords: ["bookmark", "link", "web", "url"],
      run: () => undefined
    },
    {
      id: "link",
      label: "Link to page",
      description: "Insert a page or web link",
      keywords: ["link", "page", "url", "hyperlink"],
      run: () => undefined
    },
    {
      id: "toc",
      label: "Table of contents",
      description: "Generate a list of headings",
      keywords: ["toc", "contents", "headings", "outline"],
      run: (currentEditor) => {
        const document = currentEditor.getJSON();
        const headings = (document.content ?? []).filter(
          (node) => node.type === "heading"
        );
        const items = headings.map((heading) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: headingText(heading)
                }
              ]
            }
          ]
        }));

        currentEditor
          .chain()
          .focus()
          .insertContent({
            type: "bulletList",
            content: items
          })
          .run();
      }
    },
    {
      id: "button",
      label: "Button",
      description: "Insert a button link",
      keywords: ["button", "action", "link"],
      run: () => undefined
    },
    {
      id: "equation",
      label: "Block equation",
      description: "Insert a formula block",
      keywords: ["equation", "formula", "math", "latex"],
      run: () => undefined
    },
    {
      id: "numberchart",
      label: "Number chart",
      description: "Insert a numeric metric card",
      keywords: ["number", "chart", "metric", "value"],
      run: () => undefined
    },
    {
      id: "bar",
      label: "Horizontal bar chart",
      description: "Insert a bar chart",
      keywords: ["bar", "chart", "horizontal"],
      run: () => undefined
    },
    {
      id: "line",
      label: "Line chart",
      description: "Insert a line chart",
      keywords: ["line", "chart", "trend"],
      run: () => undefined
    },
    {
      id: "donut",
      label: "Donut chart",
      description: "Insert a donut chart",
      keywords: ["donut", "chart", "pie"],
      run: () => undefined
    },
    {
      id: "breadcrumb",
      label: "Breadcrumb",
      description: "Insert the current page path",
      keywords: ["breadcrumb", "path", "navigation"],
      run: (currentEditor) => {
        const text = breadcrumb.map((item) => item.title).join(" / ");
        currentEditor
          .chain()
          .focus()
          .insertContent({
            type: "paragraph",
            content: [{ type: "text", text }]
          })
          .run();
      }
    },
    {
      id: "synced",
      label: "Synced block",
      description: "Wrap content in a synced block",
      keywords: ["synced", "sync", "block"],
      run: (currentEditor) =>
        currentEditor.chain().focus().setSyncedBlock().run()
    },
    {
      id: "columns2",
      label: "2 columns",
      description: "Create a two-column layout",
      keywords: ["columns", "layout", "two"],
      run: (currentEditor) =>
        currentEditor
          .chain()
          .focus()
          .insertContent(columnsContent(2))
          .run()
    },
    {
      id: "columns3",
      label: "3 columns",
      description: "Create a three-column layout",
      keywords: ["columns", "layout", "three"],
      run: (currentEditor) =>
        currentEditor
          .chain()
          .focus()
          .insertContent(columnsContent(3))
          .run()
    }
  ];

  return commandDefinitions.map((command) => ({
    ...command,
    category: commandCategory(command.id)
  }));
}

function getActiveBlockType(editor: Editor): string {
  if (editor.isActive("heading", { level: 1 })) {
    return "heading1";
  }
  if (editor.isActive("heading", { level: 2 })) {
    return "heading2";
  }
  if (editor.isActive("heading", { level: 3 })) {
    return "heading3";
  }
  if (editor.isActive("heading", { level: 4 })) {
    return "heading4";
  }
  if (editor.isActive("bulletList")) {
    return "bulletList";
  }
  if (editor.isActive("orderedList")) {
    return "orderedList";
  }
  if (editor.isActive("taskList")) {
    return "taskList";
  }
  if (editor.isActive("blockquote")) {
    return "blockquote";
  }
  if (editor.isActive("codeBlock")) {
    return "codeBlock";
  }
  if (editor.isActive("details")) {
    return "details";
  }
  if (editor.isActive("horizontalRule")) {
    return "divider";
  }
  if (editor.isActive("table")) {
    return "table";
  }
  if (editor.isActive("callout")) {
    return "callout";
  }
  if (editor.isActive("syncedBlock")) {
    return "synced";
  }
  return "paragraph";
}

const textColorOptions = [
  { value: "gray", label: "Gray", swatch: "#71717a" },
  { value: "brown", label: "Brown", swatch: "#8b5e3c" },
  { value: "orange", label: "Orange", swatch: "#f97316" },
  { value: "yellow", label: "Yellow", swatch: "#eab308" },
  { value: "green", label: "Green", swatch: "#22c55e" },
  { value: "blue", label: "Blue", swatch: "#3b82f6" },
  { value: "purple", label: "Purple", swatch: "#a855f7" },
  { value: "pink", label: "Pink", swatch: "#ec4899" },
  { value: "red", label: "Red", swatch: "#ef4444" }
];

function headingText(heading: JSONContent): string {
  return (heading.content ?? [])
    .map((node) => {
      if (node.type === "text") {
        return node.text ?? "";
      }
      return headingText(node);
    })
    .join("");
}

function columnsContent(count: number): JSONContent {
  return {
    type: "columns",
    attrs: { count },
    content: Array.from({ length: count }, () => ({
      type: "column",
      content: [{ type: "paragraph" }]
    }))
  };
}

const commandCategoryOrder = [
  "Basic blocks",
  "Media & Database",
  "Advanced blocks & Data source",
  "Actions & Text/Background color"
];

function commandCategory(id: string): string {
  if (
    [
      "paragraph",
      "heading1",
      "heading2",
      "heading3",
      "heading4",
      "bulletList",
      "orderedList",
      "taskList",
      "details",
      "blockquote",
      "callout",
      "codeBlock",
      "divider",
      "link"
    ].includes(id)
  ) {
    return "Basic blocks";
  }
  if (
    ["image", "video", "audio", "file", "bookmark", "table"].includes(id)
  ) {
    return "Media & Database";
  }
  if (
    ["toc", "equation", "button", "breadcrumb", "synced", "columns2", "columns3"].includes(id)
  ) {
    return "Advanced blocks & Data source";
  }
  return "Actions & Text/Background color";
}
