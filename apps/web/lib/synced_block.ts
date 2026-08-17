import { mergeAttributes, Node, wrappingInputRule } from "@tiptap/core";

export type SyncedBlockOptions = {
  HTMLAttributes: Record<string, any>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    syncedBlock: {
      setSyncedBlock: () => ReturnType;
      unsetSyncedBlock: () => ReturnType;
    };
  }
}

export const SyncedBlock = Node.create<SyncedBlockOptions>({
  name: "syncedBlock",

  content: "block+",

  group: "block",

  defining: true,

  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "block-synced"
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='synced-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "synced-block"
      }),
      0
    ];
  },

  addCommands() {
    return {
      setSyncedBlock:
        () =>
        ({ commands }) =>
          commands.setNode(this.name),
      unsetSyncedBlock:
        () =>
        ({ commands }) =>
          commands.lift(this.name)
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^>sync\s$/,
        type: this.type
      })
    ];
  }
});
