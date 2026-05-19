import { z } from "zod";

export const GHERKIN_BLOCK_TYPES = [
  "feature",
  "rule",
  "background",
  "scenario",
  "given",
  "when",
  "then",
  "and",
  "but",
] as const;

export type GherkinBlockType = (typeof GHERKIN_BLOCK_TYPES)[number];

export const GHERKIN_LABELS: Record<GherkinBlockType, string> = {
  feature: "Feature",
  rule: "Rule",
  background: "Background",
  scenario: "Scenario",
  given: "Given",
  when: "When",
  then: "Then",
  and: "And",
  but: "But",
};

// Which block types can follow which.
// "and" and "but" inherit the role of the previous step keyword.
const ALLOWED_AFTER: Record<GherkinBlockType, GherkinBlockType[]> = {
  feature: ["rule", "background", "scenario"],
  rule: ["background", "scenario"],
  background: ["given"],
  scenario: ["given"],
  given: ["when", "and", "but"],
  when: [ "then", "and", "but"],
  then: ["and", "but", "given", "scenario", "rule"],
  and: ["given", "when", "then", "and", "but", "scenario", "rule"],
  but: ["given", "when", "then", "and", "scenario", "rule"],
};

export function canFollow(
  previous: GherkinBlockType | null,
  next: GherkinBlockType
): boolean {
  if (previous === null) return next === "feature";
  return ALLOWED_AFTER[previous]?.includes(next) ?? false;
}

// What block type the Enter key should produce after a given block
export const NEXT_BLOCK_ON_ENTER: Record<GherkinBlockType, GherkinBlockType> =
  {
    feature: "scenario",
    rule: "scenario",
    background: "given",
    scenario: "given",
    given: "when",
    when: "then",
    then: "and",
    and: "and",
    but: "and",
  };

export const GherkinBlockSchema = z.object({
  type: z.enum(GHERKIN_BLOCK_TYPES),
  text: z.string(),
});

export type GherkinBlock = z.infer<typeof GherkinBlockSchema>;

export type ImageBlock = { type: "image"; src: string; alt: string };
export type DataTableBlock = { type: "data_table"; rows: string[][] };
export type DocumentBlock = GherkinBlock | ImageBlock | DataTableBlock;

function tableColWidths(rows: string[][], minWidth = 0): number[] {
  return rows[0].map((_, ci) =>
    Math.max(minWidth, ...rows.map((r) => r[ci]?.length ?? 0))
  );
}

function formatTableRow(row: string[], widths: number[]): string {
  return "| " + row.map((cell, ci) => cell.padEnd(widths[ci])).join(" | ") + " |";
}

export function exportToText(blocks: DocumentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "image") return b.src;
      if (b.type === "data_table") {
        const widths = tableColWidths(b.rows);
        return b.rows.map((row) => formatTableRow(row, widths)).join("\n");
      }
      return `${GHERKIN_LABELS[b.type]}: ${b.text}`;
    })
    .join("\n");
}

export function exportToMarkdown(blocks: DocumentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "image") return `![${b.alt}](${b.src})`;
      if (b.type === "data_table") {
        const widths = tableColWidths(b.rows, 3);
        const fmt = (row: string[]) => formatTableRow(row, widths);
        const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
        return [fmt(b.rows[0]), sep, ...b.rows.slice(1).map(fmt)].join("\n");
      }
      if (b.type === "feature") return `# Feature: ${b.text}`;
      if (b.type === "rule") return `## Rule: ${b.text}`;
      if (b.type === "background") return `## Background: ${b.text}`;
      if (b.type === "scenario") return `## Scenario: ${b.text}`;
      return `- ${GHERKIN_LABELS[b.type]}: ${b.text}`;
    })
    .join("\n");
}
