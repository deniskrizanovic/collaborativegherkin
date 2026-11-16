import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findFinishedChanges, isFinished } from "./lint-unarchived.mjs";

describe("isFinished", () => {
  it("is true when every checkbox is checked", () => {
    expect(isFinished("- [x] one\n- [x] two\n- [x] three\n")).toBe(true);
  });

  it("is false when any checkbox is unchecked", () => {
    expect(isFinished("- [x] one\n- [x] two\n- [ ] three\n")).toBe(false);
  });

  it("is false when there are no checkbox items", () => {
    expect(isFinished("## Tasks\n\nNothing to tick.\n")).toBe(false);
  });

  it("is false for empty content", () => {
    expect(isFinished("")).toBe(false);
  });

  it("accepts an uppercase X and indented checkboxes", () => {
    expect(isFinished("- [X] one\n  - [x] nested\n")).toBe(true);
  });
});

describe("findFinishedChanges", () => {
  let changesDir: string;

  const writeChange = (name: string, tasks?: string) => {
    mkdirSync(join(changesDir, name), { recursive: true });
    if (tasks !== undefined) writeFileSync(join(changesDir, name, "tasks.md"), tasks);
  };

  beforeEach(() => {
    changesDir = mkdtempSync(join(tmpdir(), "lint-unarchived-"));
  });

  afterEach(() => {
    rmSync(changesDir, { recursive: true, force: true });
  });

  it("reports a fully checked active change", () => {
    writeChange("done-change", "- [x] a\n- [x] b\n- [x] c\n");
    expect(findFinishedChanges(changesDir)).toEqual(["done-change"]);
  });

  it("does not report a change with an open task", () => {
    writeChange("wip-change", "- [x] a\n- [x] b\n- [ ] c\n");
    expect(findFinishedChanges(changesDir)).toEqual([]);
  });

  it("does not report a change with no checkbox items", () => {
    writeChange("planning-change", "## Tasks\n\nTBD\n");
    expect(findFinishedChanges(changesDir)).toEqual([]);
  });

  it("does not report a change with no tasks.md", () => {
    writeChange("proposal-only");
    expect(findFinishedChanges(changesDir)).toEqual([]);
  });

  it("ignores a fully checked change under archive/", () => {
    mkdirSync(join(changesDir, "archive", "2026-01-01-old"), { recursive: true });
    writeFileSync(join(changesDir, "archive", "2026-01-01-old", "tasks.md"), "- [x] a\n");
    expect(findFinishedChanges(changesDir)).toEqual([]);
  });

  it("names every finished change and skips the rest", () => {
    writeChange("done-a", "- [x] a\n");
    writeChange("done-b", "- [x] a\n- [x] b\n");
    writeChange("wip", "- [ ] a\n");
    expect(findFinishedChanges(changesDir).sort()).toEqual(["done-a", "done-b"]);
  });

  it("returns an empty list when the changes directory is missing", () => {
    expect(findFinishedChanges(join(changesDir, "nope"))).toEqual([]);
  });
});
