import { describe, expect, it } from "vitest";
import type { GherkinBlockType } from "@/lib/gherkin";
import {
  canFollow,
  exportToMarkdown,
  exportToText,
  GHERKIN_BLOCK_TYPES,
  GherkinBlockSchema,
  NEXT_BLOCK_ON_ENTER,
  parseGherkin,
} from "@/lib/gherkin";

// ─── canFollow ────────────────────────────────────────────────────────────────

describe("canFollow — empty document", () => {
  it("allows feature as the first block", () => {
    expect(canFollow(null, "feature")).toBe(true);
  });

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => t !== "feature"))(
    "rejects %s as the first block",
    (type) => {
      expect(canFollow(null, type)).toBe(false);
    },
  );
});

describe("canFollow — unknown previous type", () => {
  it("rejects any next block after a type with no follow rules", () => {
    expect(canFollow("image" as GherkinBlockType, "given")).toBe(false);
  });
});

describe("canFollow — after feature", () => {
  it.each(["rule", "background", "scenario"] as GherkinBlockType[])("allows %s", (type) =>
    expect(canFollow("feature", type)).toBe(true),
  );

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => !["rule", "background", "scenario"].includes(t)))(
    "rejects %s",
    (type) => expect(canFollow("feature", type)).toBe(false),
  );
});

describe("canFollow — after rule", () => {
  it.each(["background", "scenario"] as GherkinBlockType[])("allows %s", (type) =>
    expect(canFollow("rule", type)).toBe(true),
  );

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => !["background", "scenario"].includes(t)))(
    "rejects %s",
    (type) => expect(canFollow("rule", type)).toBe(false),
  );
});

describe("canFollow — after background", () => {
  it("allows given", () => expect(canFollow("background", "given")).toBe(true));

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => t !== "given"))("rejects %s", (type) =>
    expect(canFollow("background", type)).toBe(false),
  );
});

describe("canFollow — after scenario", () => {
  it("allows given", () => expect(canFollow("scenario", "given")).toBe(true));

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => t !== "given"))("rejects %s", (type) =>
    expect(canFollow("scenario", type)).toBe(false),
  );
});

describe("canFollow — after given", () => {
  it.each(["when", "and", "but"] as GherkinBlockType[])("allows %s", (type) =>
    expect(canFollow("given", type)).toBe(true),
  );

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => !["when", "and", "but"].includes(t)))(
    "rejects %s",
    (type) => expect(canFollow("given", type)).toBe(false),
  );
});

describe("canFollow — after when", () => {
  it.each(["then", "and", "but"] as GherkinBlockType[])("allows %s", (type) =>
    expect(canFollow("when", type)).toBe(true),
  );

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => !["then", "and", "but"].includes(t)))(
    "rejects %s",
    (type) => expect(canFollow("when", type)).toBe(false),
  );
});

describe("canFollow — after then", () => {
  it.each(["and", "but", "given", "scenario", "rule"] as GherkinBlockType[])("allows %s", (type) =>
    expect(canFollow("then", type)).toBe(true),
  );

  it.each(
    GHERKIN_BLOCK_TYPES.filter((t) => !["and", "but", "given", "scenario", "rule"].includes(t)),
  )("rejects %s", (type) => expect(canFollow("then", type)).toBe(false));
});

describe("canFollow — after and", () => {
  const allowed: GherkinBlockType[] = ["given", "when", "then", "and", "but", "scenario", "rule"];

  it.each(allowed)("allows %s", (type) => expect(canFollow("and", type)).toBe(true));

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => !allowed.includes(t)))("rejects %s", (type) =>
    expect(canFollow("and", type)).toBe(false),
  );
});

describe("canFollow — after but", () => {
  const allowed: GherkinBlockType[] = ["given", "when", "then", "and", "scenario", "rule"];

  it.each(allowed)("allows %s", (type) => expect(canFollow("but", type)).toBe(true));

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => !allowed.includes(t)))("rejects %s", (type) =>
    expect(canFollow("but", type)).toBe(false),
  );
});

// ─── NEXT_BLOCK_ON_ENTER ──────────────────────────────────────────────────────

describe("NEXT_BLOCK_ON_ENTER", () => {
  const table: [GherkinBlockType, GherkinBlockType][] = [
    ["feature", "scenario"],
    ["rule", "scenario"],
    ["background", "given"],
    ["scenario", "given"],
    ["given", "when"],
    ["when", "then"],
    ["then", "and"],
    ["and", "and"],
    ["but", "and"],
  ];

  it.each(table)("after %s → %s", (current, expected) => {
    expect(NEXT_BLOCK_ON_ENTER[current]).toBe(expected);
  });

  it("covers every block type", () => {
    for (const type of GHERKIN_BLOCK_TYPES) {
      expect(NEXT_BLOCK_ON_ENTER[type]).toBeDefined();
    }
  });
});

// ─── exportToText ─────────────────────────────────────────────────────────────

describe("exportToText", () => {
  it("formats a single block as 'Keyword: text'", () => {
    expect(exportToText([{ type: "feature", text: "User login" }])).toBe("Feature: User login");
  });

  it("joins multiple blocks with newlines in document order", () => {
    const result = exportToText([
      { type: "feature", text: "User login" },
      { type: "scenario", text: "Successful login" },
      { type: "given", text: "the user is on the login page" },
      { type: "when", text: "the user enters valid credentials" },
      { type: "then", text: "the user is redirected to the dashboard" },
    ]);

    expect(result).toBe(
      [
        "Feature: User login",
        "Scenario: Successful login",
        "Given: the user is on the login page",
        "When: the user enters valid credentials",
        "Then: the user is redirected to the dashboard",
      ].join("\n"),
    );
  });

  it("returns an empty string for an empty block list", () => {
    expect(exportToText([])).toBe("");
  });

  it("preserves block text exactly, including leading/trailing spaces", () => {
    expect(exportToText([{ type: "given", text: "  spaced  " }])).toBe("Given:   spaced  ");
  });

  it("labels rule and background blocks", () => {
    expect(
      exportToText([
        { type: "rule", text: "Only members" },
        { type: "background", text: "A member exists" },
      ]),
    ).toBe("Rule: Only members\nBackground: A member exists");
  });

  it("exports an image block as its source", () => {
    expect(exportToText([{ type: "image", src: "/img/flow.png", alt: "flow" }])).toBe(
      "/img/flow.png",
    );
  });
});

describe("GherkinBlockSchema", () => {
  it("accepts a block with a known type and text", () => {
    expect(GherkinBlockSchema.parse({ type: "given", text: "a step" })).toEqual({
      type: "given",
      text: "a step",
    });
  });

  it("rejects an unknown type or missing text", () => {
    expect(GherkinBlockSchema.safeParse({ type: "image", text: "x" }).success).toBe(false);
    expect(GherkinBlockSchema.safeParse({ type: "given" }).success).toBe(false);
  });
});

// ─── exportToMarkdown ─────────────────────────────────────────────────────────

describe("exportToMarkdown", () => {
  it("formats a feature block as a level-1 header", () => {
    expect(exportToMarkdown([{ type: "feature", text: "User login" }])).toBe(
      "# Feature: User login",
    );
  });

  it("formats rule, background, and scenario as level-2 headers", () => {
    expect(exportToMarkdown([{ type: "rule", text: "Auth" }])).toBe("## Rule: Auth");
    expect(exportToMarkdown([{ type: "background", text: "Setup" }])).toBe("## Background: Setup");
    expect(exportToMarkdown([{ type: "scenario", text: "Happy path" }])).toBe(
      "## Scenario: Happy path",
    );
  });

  it("formats step keywords as markdown list items", () => {
    expect(exportToMarkdown([{ type: "given", text: "a state" }])).toBe("- Given: a state");
    expect(exportToMarkdown([{ type: "when", text: "an action" }])).toBe("- When: an action");
    expect(exportToMarkdown([{ type: "then", text: "an outcome" }])).toBe("- Then: an outcome");
    expect(exportToMarkdown([{ type: "and", text: "also this" }])).toBe("- And: also this");
    expect(exportToMarkdown([{ type: "but", text: "not that" }])).toBe("- But: not that");
  });

  it("formats an image block as inline markdown image syntax", () => {
    expect(
      exportToMarkdown([{ type: "image", src: "data:image/png;base64,abc", alt: "screenshot" }]),
    ).toBe("![screenshot](data:image/png;base64,abc)");
  });

  it("produces a full document in order", () => {
    const result = exportToMarkdown([
      { type: "feature", text: "User login" },
      { type: "scenario", text: "Successful login" },
      { type: "given", text: "the user is on the login page" },
      { type: "image", src: "data:image/png;base64,xyz", alt: "screenshot" },
    ]);
    expect(result).toBe(
      [
        "# Feature: User login",
        "## Scenario: Successful login",
        "- Given: the user is on the login page",
        "![screenshot](data:image/png;base64,xyz)",
      ].join("\n"),
    );
  });

  it("returns an empty string for an empty block list", () => {
    expect(exportToMarkdown([])).toBe("");
  });
});

// ─── exportToText — data table ────────────────────────────────────────────────

describe("exportToText — data table", () => {
  it("emits pipe-delimited rows for equal-width cells", () => {
    const block = {
      type: "data_table" as const,
      rows: [
        ["a", "b"],
        ["c", "d"],
      ],
    };
    expect(exportToText([block])).toBe("| a | b |\n| c | d |");
  });

  it("pads cells to the widest value in each column", () => {
    const block = {
      type: "data_table" as const,
      rows: [
        ["name", "age"],
        ["Alice", "30"],
      ],
    };
    expect(exportToText([block])).toBe("| name  | age |\n| Alice | 30  |");
  });

  it("exports a row with fewer cells than the header", () => {
    const block = {
      type: "data_table" as const,
      rows: [["name", "age"], ["Alice"]],
    };
    expect(exportToText([block])).toBe("| name  | age |\n| Alice |");
  });

  it("includes data table rows in document order alongside other blocks", () => {
    const result = exportToText([
      { type: "given", text: "a state" },
      { type: "data_table", rows: [["x", "y"]] },
    ]);
    expect(result).toBe("Given: a state\n| x | y |");
  });
});

// ─── exportToMarkdown — data table ───────────────────────────────────────────

describe("exportToMarkdown — data table", () => {
  it("emits header row, separator, and data rows", () => {
    const block = {
      type: "data_table" as const,
      rows: [
        ["name", "age"],
        ["Alice", "30"],
      ],
    };
    expect(exportToMarkdown([block])).toBe("\n| name  | age |\n| ----- | --- |\n| Alice | 30  |\n");
  });

  it("uses minimum separator width of 3 dashes", () => {
    const block = {
      type: "data_table" as const,
      rows: [
        ["a", "b"],
        ["c", "d"],
      ],
    };
    expect(exportToMarkdown([block])).toBe("\n| a   | b   |\n| --- | --- |\n| c   | d   |\n");
  });

  it("includes data table in document order alongside other blocks", () => {
    const result = exportToMarkdown([
      { type: "given", text: "a state" },
      {
        type: "data_table",
        rows: [
          ["x", "y"],
          ["1", "2"],
        ],
      },
    ]);
    expect(result).toBe("- Given: a state\n\n| x   | y   |\n| --- | --- |\n| 1   | 2   |\n");
  });

  it("wraps table with blank lines so Markdown renderers treat it as a block element", () => {
    // A table must be preceded and followed by a blank line to render correctly
    // in CommonMark-compliant renderers (e.g. GitHub, Jira). The \n prefix and
    // suffix, combined with the \n from join(), produce that blank line.
    const result = exportToMarkdown([
      { type: "scenario", text: "Example" },
      { type: "data_table", rows: [["col"], ["val"]] },
      { type: "then", text: "it works" },
    ]);
    expect(result).toBe("## Scenario: Example\n\n| col |\n| --- |\n| val |\n\n- Then: it works");
  });
});

// ─── parseGherkin ─────────────────────────────────────────────────────────────

describe("parseGherkin", () => {
  it("parses plain, heading and list-item keyword lines, skipping blanks and prose", () => {
    const text = [
      "# Feature: Checkout",
      "",
      "## Scenario: Pay by card",
      "- Given: a basket",
      "when I pay",
      "Not a keyword line",
      "Then I see a receipt",
    ].join("\n");
    expect(parseGherkin(text)).toEqual([
      { type: "feature", text: "Checkout" },
      { type: "scenario", text: "Pay by card" },
      { type: "given", text: "a basket" },
      { type: "when", text: "I pay" },
      { type: "then", text: "I see a receipt" },
    ]);
  });

  it("groups consecutive table rows into one data table and drops separator rows", () => {
    const text = ["Given: users", "| name | age |", "| --- | :-: |", "| Ann  | 30  |"].join("\n");
    expect(parseGherkin(text)).toEqual([
      { type: "given", text: "users" },
      {
        type: "data_table",
        rows: [
          ["name", "age"],
          ["Ann", "30"],
        ],
      },
    ]);
  });

  it("starts a new data table after a keyword line", () => {
    const text = ["| a |", "And: more", "| b |"].join("\n");
    expect(parseGherkin(text)).toEqual([
      { type: "data_table", rows: [["a"]] },
      { type: "and", text: "more" },
      { type: "data_table", rows: [["b"]] },
    ]);
  });

  it("only matches a keyword at the start of the line", () => {
    expect(parseGherkin("Note: Given a step\nwe agreed Then it ships")).toEqual([]);
  });

  it("accepts several spaces after a heading or list marker", () => {
    expect(parseGherkin("##   Scenario: Pay\n-    Given a basket")).toEqual([
      { type: "scenario", text: "Pay" },
      { type: "given", text: "a basket" },
    ]);
  });

  it("parses indented keyword and table lines", () => {
    expect(parseGherkin("    Given a basket  \n\t| a | b |  ")).toEqual([
      { type: "given", text: "a basket" },
      { type: "data_table", rows: [["a", "b"]] },
    ]);
  });

  it("treats a line as a table row only when it starts and ends with a pipe", () => {
    expect(parseGherkin("Given a | b |\n| a | b | trailing")).toEqual([
      { type: "given", text: "a | b |" },
    ]);
  });

  it("drops a separator row only when the whole row is separator characters", () => {
    expect(parseGherkin("| --- | a |\n| a | --- |")).toEqual([
      {
        type: "data_table",
        rows: [
          ["---", "a"],
          ["a", "---"],
        ],
      },
    ]);
  });

  it("returns no blocks for text without keyword or table lines", () => {
    expect(parseGherkin("just some notes\n\n")).toEqual([]);
  });
});
