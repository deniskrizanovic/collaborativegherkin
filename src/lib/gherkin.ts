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

export function exportToText(blocks: GherkinBlock[]): string {
  return blocks
    .map((b) => `${GHERKIN_LABELS[b.type]}: ${b.text}`)
    .join("\n");
}
