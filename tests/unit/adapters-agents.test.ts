import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentAdapter } from "../../src/adapters/agents/index.js";
import type { DiscoveryContext } from "../../src/adapters/types.js";
import { createPlatform } from "../../src/platform/index.js";

function ctx(root: string, home: string): DiscoveryContext {
  const platform = createPlatform({ homeDir: home });
  return { root, homeDir: home, platform, readFile: (p) => platform.readFile(p) };
}

describe("agent adapter", () => {
  let tmp: string;
  let home: string;
  let root: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "devinscope-agents-"));
    home = join(tmp, "home");
    root = join(tmp, "repo");
    mkdirSync(home, { recursive: true });
    mkdirSync(join(root, ".git"), { recursive: true });
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("discovers flat and directory-layout agents with frontmatter metadata", async () => {
    mkdirSync(join(root, ".devin", "agents"), { recursive: true });
    writeFileSync(join(root, ".devin", "agents", "reviewer.md"), "---\nname: reviewer\ndescription: Reviews code\nmodel: sonnet\n---\nYou review.\n");
    mkdirSync(join(root, ".devin", "agents", "researcher"), { recursive: true });
    writeFileSync(join(root, ".devin", "agents", "researcher", "AGENT.md"), "---\nname: researcher\n---\nYou research.\n");

    const entities = await createAgentAdapter().discover(ctx(root, home));
    expect(entities.map((e) => e.name).sort()).toEqual(["researcher", "reviewer"]);
    const reviewer = entities.find((e) => e.name === "reviewer")!;
    expect(reviewer.kind).toBe("agent");
    expect(reviewer.scope).toBe("project");
    expect(reviewer.metadata.model).toBe("sonnet");
  });

  it("discovers global agents and Claude-compat agents", async () => {
    mkdirSync(join(home, ".config", "devin", "agents"), { recursive: true });
    writeFileSync(join(home, ".config", "devin", "agents", "helper.md"), "---\nname: helper\n---\nbody\n");
    mkdirSync(join(root, ".claude", "agents"), { recursive: true });
    writeFileSync(join(root, ".claude", "agents", "scout.md"), "---\nname: scout\ntools: [read]\n---\nbody\n");

    const entities = await createAgentAdapter().discover(ctx(root, home));
    const helper = entities.find((e) => e.name === "helper")!;
    const scout = entities.find((e) => e.name === "scout")!;
    expect(helper.scope).toBe("global");
    expect(scout.scope).toBe("compatibility");
  });

  it("flags conflicts with built-in profiles as AGENT_BUILTIN_CONFLICT (MEDIUM)", async () => {
    mkdirSync(join(root, ".devin", "agents"), { recursive: true });
    writeFileSync(join(root, ".devin", "agents", "subagent_explore.md"), "---\nname: subagent_explore\n---\nbody\n");

    const adapter = createAgentAdapter();
    const entities = await adapter.discover(ctx(root, home));
    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    const conflict = diagnostics.find((d) => d.code === "AGENT_BUILTIN_CONFLICT")!;
    expect(conflict.severity).toBe("MEDIUM");
    expect(conflict.explanation).toMatch(/skipped with a warning/i);
  });
});
