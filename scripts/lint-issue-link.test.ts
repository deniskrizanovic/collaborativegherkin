import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseIssueUrl, collectActiveChanges, findViolations } from "./lint-issue-link.mjs";

const openIssueProposal = `## GitHub Issue

https://github.com/deniskrizanovic/collaborativegherkin/issues/21

## Why

Some reason.
`;

const noSectionProposal = `## Why

Some reason.
`;

const emptySection = `## GitHub Issue

TBD

## Why

Some reason.
`;

describe("parseIssueUrl", () => {
  it("extracts the issue number from a full github.com issues URL", () => {
    expect(parseIssueUrl(openIssueProposal)).toBe("21");
  });

  it("returns null when no ## GitHub Issue section is present", () => {
    expect(parseIssueUrl(noSectionProposal)).toBeNull();
  });

  it("returns null when the section contains no recognisable URL", () => {
    expect(parseIssueUrl(emptySection)).toBeNull();
  });
});

describe("findViolations", () => {
  it("returns no violations when issue resolves to open", async () => {
    const changes = [{ name: "my-change", proposalContent: openIssueProposal }];
    const lookup = async (_n: string) => "open";
    expect(await findViolations(changes, lookup)).toEqual([]);
  });

  it("flags a change with no ## GitHub Issue section", async () => {
    const changes = [{ name: "my-change", proposalContent: noSectionProposal }];
    const lookup = async (_n: string) => "open";
    const violations = await findViolations(changes, lookup);
    expect(violations).toHaveLength(1);
    expect(violations[0].change).toBe("my-change");
  });

  it("flags a change whose section contains no recognisable URL", async () => {
    const changes = [{ name: "my-change", proposalContent: emptySection }];
    const lookup = async (_n: string) => "open";
    const violations = await findViolations(changes, lookup);
    expect(violations).toHaveLength(1);
    expect(violations[0].change).toBe("my-change");
  });

  it("flags a change whose issue is closed", async () => {
    const changes = [{ name: "my-change", proposalContent: openIssueProposal }];
    const lookup = async (_n: string) => "closed";
    const violations = await findViolations(changes, lookup);
    expect(violations).toHaveLength(1);
    expect(violations[0].change).toBe("my-change");
  });

  it("flags a change whose issue lookup returns not-found (throws)", async () => {
    const changes = [{ name: "my-change", proposalContent: openIssueProposal }];
    const lookup = async (_n: string) => { throw new Error("HTTP 404: Not Found"); };
    const violations = await findViolations(changes, lookup);
    expect(violations).toHaveLength(1);
    expect(violations[0].change).toBe("my-change");
  });

  it("fails closed when the lookup errors (unauthenticated / offline)", async () => {
    const changes = [{ name: "my-change", proposalContent: openIssueProposal }];
    const lookup = async (_n: string) => { throw new Error("gh: not authenticated"); };
    const violations = await findViolations(changes, lookup);
    expect(violations).toHaveLength(1);
    expect(violations[0].change).toBe("my-change");
  });
});

describe("collectActiveChanges", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "issue-link-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns change directory names, skipping archive/", () => {
    mkdirSync(join(tmpDir, "my-change"));
    mkdirSync(join(tmpDir, "archive"));
    mkdirSync(join(tmpDir, "archive", "old-change"), { recursive: true });

    const changes = collectActiveChanges(tmpDir);
    expect(changes).toContain("my-change");
    expect(changes).not.toContain("archive");
    expect(changes).not.toContain("old-change");
  });

  it("returns empty array when the directory is empty", () => {
    expect(collectActiveChanges(tmpDir)).toEqual([]);
  });

  it("returns empty array when the directory does not exist", () => {
    expect(collectActiveChanges(join(tmpDir, "nonexistent"))).toEqual([]);
  });
});
