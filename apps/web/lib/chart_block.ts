import { mergeAttributes, Node } from "@tiptap/core";

export type ChartBlockOptions = {
  HTMLAttributes: Record<string, any>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    chartBlock: {
      setChartBlock: (attributes: {
        chartType: "bar" | "line" | "donut";
        data: string;
        labels?: string;
      }) => ReturnType;
    };
  }
}

export const ChartBlock = Node.create<ChartBlockOptions>({
  name: "chartBlock",

  group: "block",

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "block-chart"
      }
    };
  },

  addAttributes() {
    return {
      chartType: {
        default: "bar"
      },
      data: {
        default: ""
      },
      labels: {
        default: ""
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='chart-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { chartType, data, labels } = HTMLAttributes;
    const values = String(data)
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    if (chartType === "bar") {
      return [
        "div",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          "data-type": "chart-block",
          "data-chart-type": "bar"
        }),
        ...values.map((value) => [
          "div",
          {
            class: "block-chart-bar",
            style: `height: ${Math.max(4, Math.min(100, value))}%`
          }
        ])
      ];
    }

    if (chartType === "line") {
      const width = 300;
      const height = 120;
      const max = Math.max(...values, 1);
      const points = values
        .map((value, index) => {
          const x = (index / Math.max(values.length - 1, 1)) * width;
          const y = height - (value / max) * height;
          return `${x},${y}`;
        })
        .join(" ");
      return [
        "div",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          "data-type": "chart-block",
          "data-chart-type": "line"
        }),
        [
          "svg",
          { viewBox: `0 0 ${width} ${height}`, class: "block-chart-svg" },
          ["polyline", { points, fill: "none", stroke: "currentColor" }]
        ]
      ];
    }

    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const circles = values.map((value) => {
      const dash = (value / total) * circumference;
      const circle = [
        "circle",
        {
          cx: "60",
          cy: "60",
          r: radius,
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "18",
          "stroke-dasharray": `${dash} ${circumference - dash}`,
          "stroke-dashoffset": offset
        }
      ];
      offset -= dash;
      return circle;
    });

    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "chart-block",
        "data-chart-type": "donut"
      }),
      ["svg", { viewBox: "0 0 120 120", class: "block-chart-svg" }, ...circles]
    ];
  },

  addCommands() {
    return {
      setChartBlock:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes })
    };
  }
});
