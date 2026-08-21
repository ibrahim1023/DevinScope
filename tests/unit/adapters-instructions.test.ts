import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstructionsAdapter } from "../../src/adapters/instructions/index.js";
import type { DiscoveryContext } from "../../src/adapters/types.js";
import { createPlatform } from "../../src/platform/index.js";

function ctx(root: string, home: string): DiscoveryContext {
  const platform = createPlatform({ homeDir: home });
  return { root, homeDir: home, platform, readFile: (p) => platform.readFile(p) };
}

describe("instructions adapter", () => {
  let tmp: string;
  let home: string;
  let root: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "devinscope-instr-"));
    home = join(tmp, "home");
    root = join(tmp, "repo");
    mkdirSync(home, { recursive: true });
    mkdirSync(join(root, ".git"), { recursive: true });
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("detect returns false for an empty project, true when AGENTS.md exists", async () => {
    const adapter = createInstructionsAdapter();
    await expect(adapter.detect(ctx(root, home))).resolves.toBe(false);
    writeFileSync(join(root, "AGENTS.md"), "# Rules\n");
    await expect(adapter.detect(ctx(root, home))).resolves.toBe(true);
  });

  it("discovers project AGENTS.md and .devin/rules/*.md with provenance", async () => {
    writeFileSync(join(root, "AGENTS.md"), "# Project Rules\nUse pnpm.\n");
    mkdirSync(join(root, ".devin", "rules"), { recursive: true });
    writeFileSync(join(root, ".devin", "rules", "style.md"), "---\ntrigger: always_on\n---\nBe concise.\n");

    const entities = await createInstructionsAdapter().discover(ctx(root, home));
    expect(entities).toHaveLength(2);

    const agents = entities.find((e) => e.name === "AGENTS.md")!;
    expect(agents.kind).toBe("instruction");
    expect(agents.scope).toBe("project");
    expect(agents.status).toBe("available");
    expect(agents.provenance.resolution).toBe("direct");
    expect(agents.provenance.docRef).toMatch(/rules/);
    expect(agents.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(agents.metadata.bytes).toBeGreaterThan(0);

    const rule = entities.find((e) => e.kind === "rule")!;
    expect(rule.scope).toBe("project");
    expect(rule.sourcePath).toContain(join(".devin", "rules"));
  });

  it("discovers global AGENTS.md under the devin user config dir", async () => {
    mkdirSync(join(home, ".config", "devin"), { recursive: true });
    writeFileSync(join(home, ".config", "devin", "AGENTS.md"), "# Global\n");

    const entities = await createInstructionsAdapter().discover(ctx(root, home));
    const global = entities.find((e) => e.scope === "global")!;
    expect(global.kind).toBe("instruction");
    expect(global.name).toBe("AGENTS.md");
  });

  it("discovers Claude-compat rules and labels scope compatibility", async () => {
    writeFileSync(join(root, "CLAUDE.md"), "# Claude rules\n");
    const entities = await createInstructionsAdapter().discover(ctx(root, home));
    const claude = entities.find((e) => e.name === "CLAUDE.md")!;
    expect(claude.scope).toBe("compatibility");
  });

  it("returns empty for a project with no instruction sources", async () => {
    await expect(createInstructionsAdapter().discover(ctx(root, home))).resolves.toEqual([]);
  });
});
