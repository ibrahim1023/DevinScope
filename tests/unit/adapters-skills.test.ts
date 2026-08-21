import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSkillAdapter } from "../../src/adapters/skills/index.js";
import type { DiscoveryContext } from "../../src/adapters/types.js";
import { createPlatform } from "../../src/platform/index.js";

function ctx(root: string, home: string): DiscoveryContext {
  const platform = createPlatform({ homeDir: home });
  return { root, homeDir: home, platform, readFile: (p) => platform.readFile(p) };
}

const SKILL = (name: string) => `---\nname: ${name}\ndescription: Does ${name} things\n---\n\nBody of ${name}.\n`;

describe("skill adapter", () => {
  let tmp: string;
  let home: string;
  let root: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "devinscope-skills-"));
    home = join(tmp, "home");
    root = join(tmp, "repo");
    mkdirSync(home, { recursive: true });
    mkdirSync(join(root, ".git"), { recursive: true });
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("discovers project and global skills with the same name, both available, resolution unknown (ADR-0003)", async () => {
    mkdirSync(join(root, ".agents", "skills", "review"), { recursive: true });
    writeFileSync(join(root, ".agents", "skills", "review", "SKILL.md"), SKILL("review"));
    mkdirSync(join(home, ".config", "devin", "skills", "review"), { recursive: true });
    writeFileSync(join(home, ".config", "devin", "skills", "review", "SKILL.md"), SKILL("review"));

    const entities = await createSkillAdapter().discover(ctx(root, home));
    expect(entities).toHaveLength(2);
    for (const e of entities) {
      expect(e.kind).toBe("skill");
      expect(e.name).toBe("review");
      expect(e.status).toBe("available");
      expect(e.provenance.resolution).toBe("direct");
    }
    expect(entities.map((e) => e.scope).sort()).toEqual(["global", "project"]);
  });

  it("exposes description, bodyChars and supporting file counts", async () => {
    const dir = join(root, ".devin", "skills", "explain");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), SKILL("explain"));
    writeFileSync(join(dir, "helper.ts"), "export {};\n");
    mkdirSync(join(dir, "references"), { recursive: true });
    writeFileSync(join(dir, "references", "ref.md"), "# ref\n");

    const [entity] = await createSkillAdapter().discover(ctx(root, home));
    expect(entity!.metadata.description).toBe("Does explain things");
    expect(entity!.metadata.bodyChars).toBeGreaterThan(0);
    expect(entity!.metadata.supportingFiles).toBe(2);
  });

  it("marks malformed frontmatter invalid and keeps the parse error in metadata", async () => {
    mkdirSync(join(root, ".devin", "skills", "broken"), { recursive: true });
    writeFileSync(join(root, ".devin", "skills", "broken", "SKILL.md"), "no frontmatter\n");

    const [entity] = await createSkillAdapter().discover(ctx(root, home));
    expect(entity!.status).toBe("invalid");
    expect(entity!.metadata.parseError).toMatch(/frontmatter/i);
  });

  it("discovers codeium channel skills at global scope", async () => {
    mkdirSync(join(home, ".codeium", "windsurf", "skills", "lint"), { recursive: true });
    writeFileSync(join(home, ".codeium", "windsurf", "skills", "lint", "SKILL.md"), SKILL("lint"));

    const entities = await createSkillAdapter().discover(ctx(root, home));
    expect(entities).toHaveLength(1);
    expect(entities[0]!.scope).toBe("global");
    expect(entities[0]!.metadata.channel).toBe("windsurf");
  });
});
