import { mergeAttributes, Node } from "@tiptap/core";

export type ColumnsOptions = {
  HTMLAttributes: Record<string, any>;
};

export type ColumnOptions = {
  HTMLAttributes: Record<string, any>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (count: number) => ReturnType;
    };
  }
}

export const Columns = Node.create<ColumnsOptions>({
  name: "columns",

  content: "column+",

  group: "block",

  defining: true,

  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "block-columns"
      }
    };
  },

  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (element) => Number(element.getAttribute("data-columns") || 2),
        renderHTML: (attributes) => ({
          "data-columns": attributes.count
        })
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='columns']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "columns"
      }),
      0
    ];
  }
});

export const Column = Node.create<ColumnOptions>({
  name: "column",

  content: "block+",

  group: "block",

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "block-column"
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='column']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "column"
      }),
      0
    ];
  }
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (count: number) => ReturnType;
    };
  }
}

export const ColumnsKit = Node.create({
  name: "columnsKit",

  addExtensions() {
    return [Columns, Column];
  },

  addCommands() {
    return {
      setColumns:
        (count) =>
        ({ commands }) => {
          const columns = Array.from({ length: count }, () => ({
            type: "column",
            content: [{ type: "paragraph" }]
          }));
          return commands.insertContent({
            type: "columns",
            attrs: { count },
            content: columns
          });
        }
    };
  }
});
