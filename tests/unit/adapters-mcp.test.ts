import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMcpAdapter } from "../../src/adapters/mcp/index.js";
import type { DiscoveryContext } from "../../src/adapters/types.js";
import { createPlatform } from "../../src/platform/index.js";

function ctx(root: string, home: string): DiscoveryContext {
  const platform = createPlatform({ homeDir: home });
  return { root, homeDir: home, platform, readFile: (p) => platform.readFile(p) };
}

describe("mcp adapter", () => {
  let tmp: string;
  let home: string;
  let root: string;

  const writeMcp = (dir: string, servers: Record<string, unknown>) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "mcp_config.json"), JSON.stringify({ mcpServers: servers }));
  };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "devinscope-mcp-"));
    home = join(tmp, "home");
    root = join(tmp, "repo");
    mkdirSync(home, { recursive: true });
    mkdirSync(join(root, ".git"), { recursive: true });
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("merges same-named servers by documented precedence: project-local > project > user", async () => {
    writeMcp(join(home, ".config", "devin"), { github: { command: "npx", args: ["-y", "gh-mcp"] } });
    writeMcp(join(root, ".devin"), { github: { url: "https://mcp.github.example/mcp" } });
    writeFileSync(
      join(root, ".devin", "mcp_config.local.json"),
      JSON.stringify({ mcpServers: { github: { url: "https://local.example/mcp" } } }),
    );

    const entities = await createMcpAdapter().discover(ctx(root, home));
    const github = entities.filter((e) => e.name === "github");
    expect(github).toHaveLength(3);

    const active = github.find((e) => e.status === "active")!;
    expect(active.scope).toBe("project-local");
    expect(active.provenance.resolution).toBe("documented-precedence");
    expect(active.provenance.docRef).toContain("global-vs-local");

    const shadowed = github.filter((e) => e.status === "shadowed");
    expect(shadowed).toHaveLength(2);
    expect(shadowed.every((e) => e.provenance.overriddenBy?.includes(active.id))).toBe(true);
    expect(active.provenance.overrides?.sort()).toEqual(shadowed.map((e) => e.id).sort());
  });

  it("never exposes env values — only configured/missing markers", async () => {
    writeMcp(join(root, ".devin"), {
      github: { command: "npx", env: { GITHUB_TOKEN: "ghp_CANARYSECRET", EMPTY: "" } },
    });
    const entities = await createMcpAdapter().discover(ctx(root, home));
    const env = entities[0]!.metadata.env as Record<string, string>;
    expect(env).toEqual({ GITHUB_TOKEN: "configured", EMPTY: "missing" });
    expect(JSON.stringify(entities)).not.toContain("ghp_CANARYSECRET");
  });

  it("marks disabled servers as disabled", async () => {
    writeMcp(join(root, ".devin"), { off: { command: "npx", disabled: true } });
    const [e] = await createMcpAdapter().discover(ctx(root, home));
    expect(e!.status).toBe("disabled");
  });

  it("discovers legacy mcpServers in config.json and reports MCP_LEGACY_LOCATION (INFO)", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(join(root, ".devin", "config.json"), JSON.stringify({ mcpServers: { old: { command: "npx" } } }));

    const adapter = createMcpAdapter();
    const entities = await adapter.discover(ctx(root, home));
    expect(entities.map((e) => e.name)).toContain("old");

    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    expect(diagnostics.find((d) => d.code === "MCP_LEGACY_LOCATION")!.severity).toBe("INFO");
  });

  it("validate flags missing env refs, bad URLs and missing commands", async () => {
    writeMcp(join(root, ".devin"), {
      needsEnv: { command: "npx", env: { SECRET: "${env:DEFINITELY_UNSET_DEVINSCOPE_VAR}" } },
      badUrl: { url: "not-a-url" },
      missingCmd: { command: "definitely-not-a-real-binary-xyz" },
    });

    const adapter = createMcpAdapter();
    const entities = await adapter.discover(ctx(root, home));
    const diagnostics = await adapter.validate!(entities, ctx(root, home));

    const codes = Object.fromEntries(diagnostics.map((d) => [d.code, d]));
    expect(codes.MCP_MISSING_ENV!.severity).toBe("MEDIUM");
    expect(codes.MCP_MISSING_ENV!.evidence.join(" ")).toContain("DEFINITELY_UNSET_DEVINSCOPE_VAR");
    expect(codes.MCP_BAD_URL!.severity).toBe("MEDIUM");
    expect(codes.MCP_CMD_MISSING!.severity).toBe("HIGH");
  });
});
