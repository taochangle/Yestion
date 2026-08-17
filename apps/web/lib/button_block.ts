import { mergeAttributes, Node } from "@tiptap/core";

export type ButtonBlockOptions = {
  HTMLAttributes: Record<string, any>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    buttonBlock: {
      setButtonBlock: (attributes: {
        label: string;
        url: string;
        color?: string;
      }) => ReturnType;
    };
  }
}

export const ButtonBlock = Node.create<ButtonBlockOptions>({
  name: "buttonBlock",

  group: "block",

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "block-button"
      }
    };
  },

  addAttributes() {
    return {
      label: {
        default: "Button"
      },
      url: {
        default: "#"
      },
      color: {
        default: "default"
      }
    };
  },

  parseHTML() {
    return [{ tag: "a[data-type='button-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { label, url, color } = HTMLAttributes;
    return [
      "a",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
        "data-type": "button-block",
        "data-button-color": color
      }),
      label
    ];
  },

  addCommands() {
    return {
      setButtonBlock:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes })
    };
  }
});
