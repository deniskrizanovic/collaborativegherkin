import { Node, mergeAttributes } from "@tiptap/core";

export const GherkinParagraph = Node.create({
  name: "paragraph",
  priority: 1000,
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      "data-gherkin-type": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-gherkin-type"),
        renderHTML: (attrs) =>
          attrs["data-gherkin-type"]
            ? { "data-gherkin-type": attrs["data-gherkin-type"] }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "p" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes), 0];
  },
});
