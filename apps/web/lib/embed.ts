import { mergeAttributes, Node } from "@tiptap/core";

export type EmbedOptions = {
  HTMLAttributes: Record<string, any>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attributes: {
        src: string;
        embedType: "video" | "audio" | "file" | "bookmark";
        title?: string;
        description?: string;
      }) => ReturnType;
    };
  }
}

export const Embed = Node.create<EmbedOptions>({
  name: "embed",

  group: "block",

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "block-embed"
      }
    };
  },

  addAttributes() {
    return {
      src: {
        default: null
      },
      embedType: {
        default: "file"
      },
      title: {
        default: null
      },
      description: {
        default: null
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='embed']" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { embedType, src, title, description } = HTMLAttributes;
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      "data-type": "embed",
      "data-embed-type": embedType
    });

    if (embedType === "video") {
      return ["div", attrs, ["video", { controls: "true", src }, 0]];
    }
    if (embedType === "audio") {
      return ["div", attrs, ["audio", { controls: "true", src }, 0]];
    }
    if (embedType === "bookmark") {
      return [
        "div",
        attrs,
        ["a", { href: src, target: "_blank", rel: "noopener" }, title || src],
        ["p", { class: "block-embed-description" }, description || ""]
      ];
    }

    return [
      "div",
      attrs,
      ["a", { href: src, target: "_blank", rel: "noopener" }, title || src]
    ];
  },

  addCommands() {
    return {
      setEmbed:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes })
    };
  }
});
