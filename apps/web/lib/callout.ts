import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";

export type CalloutOptions = {
  HTMLAttributes: Record<string, any>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { color?: string; emoji?: string }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: "callout",

  content: "paragraph+",

  group: "block",

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "block-callout"
      }
    };
  },

  addAttributes() {
    return {
      color: {
        default: "gray",
        parseHTML: (element) => element.getAttribute("data-callout-color"),
        renderHTML: (attributes) => ({
          "data-callout-color": attributes.color
        })
      },
      emoji: {
        default: "💡",
        parseHTML: (element) => element.getAttribute("data-callout-emoji"),
        renderHTML: (attributes) => ({
          "data-callout-emoji": attributes.emoji
        })
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='callout']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "callout"
      }),
      ["span", { class: "block-callout-emoji", contenteditable: "false" }, HTMLAttributes.emoji],
      ["div", { class: "block-callout-content" }, 0]
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes = {}) =>
        ({ commands }) =>
          commands.setNode(this.name, attributes),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name)
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^>!\s$/,
        type: this.type
      })
    ];
  }
});
