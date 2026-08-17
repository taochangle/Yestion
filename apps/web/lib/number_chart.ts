import { mergeAttributes, Node } from "@tiptap/core";

export type NumberChartOptions = {
  HTMLAttributes: Record<string, any>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    numberChart: {
      setNumberChart: (attributes: {
        label: string;
        value: string;
        color?: string;
      }) => ReturnType;
    };
  }
}

export const NumberChart = Node.create<NumberChartOptions>({
  name: "numberChart",

  group: "block",

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "block-number-chart"
      }
    };
  },

  addAttributes() {
    return {
      label: {
        default: ""
      },
      value: {
        default: "0"
      },
      color: {
        default: "blue"
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='number-chart']" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { label, value, color } = HTMLAttributes;
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "number-chart",
        "data-number-color": color
      }),
      ["span", { class: "block-number-chart-value" }, value],
      ["span", { class: "block-number-chart-label" }, label]
    ];
  },

  addCommands() {
    return {
      setNumberChart:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes })
    };
  }
});
