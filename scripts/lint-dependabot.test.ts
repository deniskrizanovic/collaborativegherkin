import { describe, it, expect } from "vitest";
import { lintDependabot } from "./lint-dependabot.mjs";

const CONFIG_PATH = ".github/dependabot.yml";
const ADR_PATH = "docs/adr/0004-latest-stable-dependency-principle.md";

const adr = `# ADR 0004 — Latest Stable Dependency Principle

### Exception: \`next-auth\`

\`next-auth\` is pinned. \`@auth/core\` and \`@auth/prisma-adapter\` move in lockstep.

### Exception: \`eslint\`

ESLint 10 is deferred until every plugin in \`eslint-config-next\` accepts it.
`;

const validConfig = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    assignees:
      - "deniskrizanovic"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
    ignore:
      - dependency-name: "next-auth"
        update-types: ["version-update:semver-major"]
      - dependency-name: "eslint"
        update-types: ["version-update:semver-major"]
      - dependency-name: "@auth/core"
      - dependency-name: "@auth/prisma-adapter"
`;

/** Build a single-entry npm config with the given extra keys and ignore entries. */
function npmConfig({
  extra = '    assignees: ["deniskrizanovic"]\n',
  ignore = [] as string[],
} = {}) {
  const ignoreBlock =
    ignore.length === 0
      ? ""
      : "    ignore:\n" + ignore.map((name) => `      - dependency-name: "${name}"\n`).join("");
  return `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
${extra}${ignoreBlock}`;
}

function lint(configContent: string | null, adrContent: string = adr) {
  return lintDependabot(configContent, adrContent, {
    configPath: CONFIG_PATH,
    adrPath: ADR_PATH,
  });
}

describe("lintDependabot — YAML validity", () => {
  it("accepts a well-formed config", () => {
    expect(lint(validConfig)).toEqual([]);
  });

  it("flags a YAML syntax error with its line", () => {
    const broken = validConfig.replace('- "minor"', '- "minor"W');
    const brokenLine = broken.split("\n").findIndex((l) => l.includes('"minor"W')) + 1;

    const violations = lint(broken);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain(CONFIG_PATH);
    expect(violations[0]).toMatch(new RegExp(`line ${brokenLine}\\b`));
  });

  it("flags an absent config file", () => {
    const violations = lint(null);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain(CONFIG_PATH);
    expect(violations[0]).toMatch(/missing/i);
  });
});

describe("lintDependabot — ignore rules documented in ADR 0004", () => {
  it("accepts ignore entries cited in the ADR", () => {
    expect(lint(npmConfig({ ignore: ["eslint", "@auth/core"] }))).toEqual([]);
  });

  it("flags an ignore entry not cited in the ADR", () => {
    const violations = lint(npmConfig({ ignore: ["left-pad"] }));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("left-pad");
    expect(violations[0]).toContain(ADR_PATH);
  });

  it("does not let `eslint-config-next` alone satisfy an `eslint` ignore", () => {
    const adrWithoutEslint = "Plugins pulled in by `eslint-config-next` are fine.\n";
    const violations = lint(npmConfig({ ignore: ["eslint"] }), adrWithoutEslint);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('"eslint"');
  });
});

describe("lintDependabot — assignees", () => {
  it("accepts an update entry assigned to the owner", () => {
    expect(lint(npmConfig())).toEqual([]);
  });

  it("flags an update entry with no assignees", () => {
    const violations = lint(npmConfig({ extra: "" }));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("npm");
    expect(violations[0]).toContain("deniskrizanovic");
  });

  it("flags the retired `reviewers` key", () => {
    const violations = lint(
      npmConfig({
        extra: '    assignees: ["deniskrizanovic"]\n    reviewers: ["deniskrizanovic"]\n',
      })
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("reviewers");
    expect(violations[0]).toMatch(/retired/i);
  });
});
