import { describe, it, expect } from "vitest";
import {
  canFollow,
  NEXT_BLOCK_ON_ENTER,
  exportToText,
  GHERKIN_BLOCK_TYPES,
} from "@/lib/gherkin";
import type { GherkinBlockType } from "@/lib/gherkin";

// ─── canFollow ────────────────────────────────────────────────────────────────

describe("canFollow — empty document", () => {
  it("allows feature as the first block", () => {
    expect(canFollow(null, "feature")).toBe(true);
  });

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => t !== "feature"))(
    "rejects %s as the first block",
    (type) => {
      expect(canFollow(null, type)).toBe(false);
    }
  );
});

describe("canFollow — after feature", () => {
  it.each(["rule", "background", "scenario"] as GherkinBlockType[])(
    "allows %s",
    (type) => expect(canFollow("feature", type)).toBe(true)
  );

  it.each(
    GHERKIN_BLOCK_TYPES.filter(
      (t) => !["rule", "background", "scenario"].includes(t)
    )
  )("rejects %s", (type) => expect(canFollow("feature", type)).toBe(false));
});

describe("canFollow — after rule", () => {
  it.each(["background", "scenario"] as GherkinBlockType[])(
    "allows %s",
    (type) => expect(canFollow("rule", type)).toBe(true)
  );

  it.each(
    GHERKIN_BLOCK_TYPES.filter((t) => !["background", "scenario"].includes(t))
  )("rejects %s", (type) => expect(canFollow("rule", type)).toBe(false));
});

describe("canFollow — after background", () => {
  it("allows given", () => expect(canFollow("background", "given")).toBe(true));

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => t !== "given"))(
    "rejects %s",
    (type) => expect(canFollow("background", type)).toBe(false)
  );
});

describe("canFollow — after scenario", () => {
  it("allows given", () => expect(canFollow("scenario", "given")).toBe(true));

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => t !== "given"))(
    "rejects %s",
    (type) => expect(canFollow("scenario", type)).toBe(false)
  );
});

describe("canFollow — after given", () => {
  it.each(["when", "and", "but"] as GherkinBlockType[])(
    "allows %s",
    (type) => expect(canFollow("given", type)).toBe(true)
  );

  it.each(
    GHERKIN_BLOCK_TYPES.filter(
      (t) => !["when", "and", "but"].includes(t)
    )
  )("rejects %s", (type) => expect(canFollow("given", type)).toBe(false));
});

describe("canFollow — after when", () => {
  it.each(["then", "and", "but"] as GherkinBlockType[])(
    "allows %s",
    (type) => expect(canFollow("when", type)).toBe(true)
  );

  it.each(
    GHERKIN_BLOCK_TYPES.filter(
      (t) => !["then", "and", "but"].includes(t)
    )
  )("rejects %s", (type) => expect(canFollow("when", type)).toBe(false));
});

describe("canFollow — after then", () => {
  it.each(["and", "but", "given", "scenario", "rule"] as GherkinBlockType[])(
    "allows %s",
    (type) => expect(canFollow("then", type)).toBe(true)
  );

  it.each(
    GHERKIN_BLOCK_TYPES.filter(
      (t) => !["and", "but", "given", "scenario", "rule"].includes(t)
    )
  )("rejects %s", (type) => expect(canFollow("then", type)).toBe(false));
});

describe("canFollow — after and", () => {
  const allowed: GherkinBlockType[] = [
    "given", "when", "then", "and", "but", "scenario", "rule",
  ];

  it.each(allowed)("allows %s", (type) =>
    expect(canFollow("and", type)).toBe(true)
  );

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => !allowed.includes(t)))(
    "rejects %s",
    (type) => expect(canFollow("and", type)).toBe(false)
  );
});

describe("canFollow — after but", () => {
  const allowed: GherkinBlockType[] = [
    "given", "when", "then", "and", "scenario", "rule",
  ];

  it.each(allowed)("allows %s", (type) =>
    expect(canFollow("but", type)).toBe(true)
  );

  it.each(GHERKIN_BLOCK_TYPES.filter((t) => !allowed.includes(t)))(
    "rejects %s",
    (type) => expect(canFollow("but", type)).toBe(false)
  );
});

// ─── NEXT_BLOCK_ON_ENTER ──────────────────────────────────────────────────────

describe("NEXT_BLOCK_ON_ENTER", () => {
  const table: [GherkinBlockType, GherkinBlockType][] = [
    ["feature",    "scenario"],
    ["rule",       "scenario"],
    ["background", "given"],
    ["scenario",   "given"],
    ["given",      "when"],
    ["when",       "then"],
    ["then",       "and"],
    ["and",        "and"],
    ["but",        "and"],
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
    expect(exportToText([{ type: "feature", text: "User login" }])).toBe(
      "Feature: User login"
    );
  });

  it("joins multiple blocks with newlines in document order", () => {
    const result = exportToText([
      { type: "feature",  text: "User login" },
      { type: "scenario", text: "Successful login" },
      { type: "given",    text: "the user is on the login page" },
      { type: "when",     text: "the user enters valid credentials" },
      { type: "then",     text: "the user is redirected to the dashboard" },
    ]);

    expect(result).toBe(
      [
        "Feature: User login",
        "Scenario: Successful login",
        "Given: the user is on the login page",
        "When: the user enters valid credentials",
        "Then: the user is redirected to the dashboard",
      ].join("\n")
    );
  });

  it("returns an empty string for an empty block list", () => {
    expect(exportToText([])).toBe("");
  });

  it("preserves block text exactly, including leading/trailing spaces", () => {
    expect(exportToText([{ type: "given", text: "  spaced  " }])).toBe(
      "Given:   spaced  "
    );
  });
});
