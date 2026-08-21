import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHookAdapter } from "../../src/adapters/hooks/index.js";
import type { DiscoveryContext } from "../../src/adapters/types.js";
import { createPlatform } from "../../src/platform/index.js";

function ctx(root: string, home: string): DiscoveryContext {
  const platform = createPlatform({ homeDir: home });
  return { root, homeDir: home, platform, readFile: (p) => platform.readFile(p) };
}

describe("hook adapter", () => {
  let tmp: string;
  let home: string;
  let root: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "devinscope-hooks-"));
    home = join(tmp, "home");
    root = join(tmp, "repo");
    mkdirSync(home, { recursive: true });
    mkdirSync(join(root, ".git"), { recursive: true });
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("discovers hooks from .devin/hooks.v1.json with event and matcher metadata", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "scripts", "check.sh"), "#!/bin/sh\nexit 0\n");
    writeFileSync(
      join(root, ".devin", "hooks.v1.json"),
      JSON.stringify({
        PreToolUse: [{ matcher: "exec", hooks: [{ type: "command", command: "./scripts/check.sh", timeout: 10 }] }],
      }),
    );

    const entities = await createHookAdapter().discover(ctx(root, home));
    expect(entities).toHaveLength(1);
    const hook = entities[0]!;
    expect(hook.kind).toBe("hook");
    expect(hook.name).toBe("PreToolUse:exec");
    expect(hook.scope).toBe("project");
    expect(hook.metadata.event).toBe("PreToolUse");
    expect(hook.metadata.matcher).toBe("exec");
    expect(hook.metadata.command).toBe("./scripts/check.sh");
    expect(hook.metadata.timeout).toBe(10);
  });

  it("discovers hooks nested under the hooks key of config files", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(
      join(root, ".devin", "config.json"),
      JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "prompt", prompt: "Summarize." }] }] } }),
    );

    const entities = await createHookAdapter().discover(ctx(root, home));
    expect(entities).toHaveLength(1);
    expect(entities[0]!.name).toBe("SessionStart:*");
    expect(entities[0]!.metadata.type).toBe("prompt");
  });

  it("validate flags a missing hook script as BROKEN_HOOK_CMD (HIGH)", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(
      join(root, ".devin", "hooks.v1.json"),
      JSON.stringify({ PreToolUse: [{ matcher: "exec", hooks: [{ type: "command", command: "./scripts/missing.sh" }] }] }),
    );

    const adapter = createHookAdapter();
    const entities = await adapter.discover(ctx(root, home));
    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    const broken = diagnostics.find((d) => d.code === "BROKEN_HOOK_CMD")!;
    expect(broken.severity).toBe("HIGH");
    expect(broken.evidence.join(" ")).toContain("scripts/missing.sh");
  });

  it("validate passes existing scripts and PATH executables", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "scripts", "ok.sh"), "#!/bin/sh\n");
    writeFileSync(
      join(root, ".devin", "hooks.v1.json"),
      JSON.stringify({
        PreToolUse: [
          { matcher: "exec", hooks: [{ type: "command", command: "./scripts/ok.sh" }] },
          { matcher: "read", hooks: [{ type: "command", command: "node ./scripts/ok.sh" }] },
        ],
      }),
    );

    const adapter = createHookAdapter();
    const entities = await adapter.discover(ctx(root, home));
    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    expect(diagnostics.filter((d) => d.code === "BROKEN_HOOK_CMD")).toEqual([]);
  });

  it("validate flags an uncompilable matcher as INVALID_HOOK_MATCHER (MEDIUM)", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(
      join(root, ".devin", "hooks.v1.json"),
      JSON.stringify({ PreToolUse: [{ matcher: "(unclosed", hooks: [{ type: "prompt", prompt: "x" }] }] }),
    );

    const adapter = createHookAdapter();
    const entities = await adapter.discover(ctx(root, home));
    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    const bad = diagnostics.find((d) => d.code === "INVALID_HOOK_MATCHER")!;
    expect(bad.severity).toBe("MEDIUM");
  });

  it("marks malformed hooks files as invalid entities with INVALID_JSON diagnostic", async () => {
    mkdirSync(join(root, ".devin"), { recursive: true });
    writeFileSync(join(root, ".devin", "hooks.v1.json"), "{ not json");

    const adapter = createHookAdapter();
    const entities = await adapter.discover(ctx(root, home));
    expect(entities).toHaveLength(1);
    expect(entities[0]!.status).toBe("invalid");

    const diagnostics = await adapter.validate!(entities, ctx(root, home));
    expect(diagnostics.find((d) => d.code === "INVALID_JSON")!.severity).toBe("ERROR");
  });
});
