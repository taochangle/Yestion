import { mergeAttributes, Node } from "@tiptap/core";

export type EquationBlockOptions = {
  HTMLAttributes: Record<string, any>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    equationBlock: {
      setEquationBlock: (expression: string) => ReturnType;
    };
  }
}

export const EquationBlock = Node.create<EquationBlockOptions>({
  name: "equationBlock",

  group: "block",

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "block-equation"
      }
    };
  },

  addAttributes() {
    return {
      expression: {
        default: ""
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='equation-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { expression } = HTMLAttributes;
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "equation-block"
      }),
      ["code", { class: "block-equation-code" }, expression]
    ];
  },

  addCommands() {
    return {
      setEquationBlock:
        (expression) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { expression }
          })
    };
  }
});
