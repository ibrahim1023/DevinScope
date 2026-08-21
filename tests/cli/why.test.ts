import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(REPO_ROOT, "dist", "cli.js");
const FIXTURES = join(REPO_ROOT, "fixtures");

const tmps: string[] = [];

function stageDemo(): { root: string; home: string; tmp: string } {
  const src = join(FIXTURES, "demo-repo", "input");
  const tmp = mkdtempSync(join(tmpdir(), "devinscope-why-"));
  const root = join(tmp, "project");
  const home = join(tmp, "home");
  cpSync(join(src, "project"), root, { recursive: true });
  cpSync(join(src, "home"), home, { recursive: true });
  tmps.push(tmp);
  return { root, home, tmp };
}

async function why(run: { root: string; home: string }, args: string[]) {
  return execa("node", [CLI, "why", ...args], {
    cwd: run.root,
    env: { DEVINSCOPE_HOME: run.home },
    reject: false,
    stripFinalNewline: false,
    maxBuffer: 64 * 1024 * 1024,
  });
}

// dist/cli.js is built once by tests/global-setup.ts — never per file (parallel workers race)

afterAll(() => {
  for (const t of tmps) rmSync(t, { recursive: true, force: true });
});

describe("why CLI", () => {
  it("explains a duplicated skill: definition, scope, duplicates, hooks, diagnostics (Story B)", async () => {
    const run = stageDemo();
    const r = await why(run, ["skill:explain-diff-html"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("WHY: explain-diff-html");
    expect(r.stdout).toContain("skill");
    expect(r.stdout).toContain("project");
    expect(r.stdout).toContain(".devin/skills/explain-diff-html/SKILL.md");
    expect(r.stdout).toContain("Also discovered"); // the global duplicate
    expect(r.stdout).toContain("PreToolUse:exec"); // hooks that may affect execution
    expect(r.stdout).toContain("DUP_SKILL"); // related diagnostic
  });

  it("matches the demo-repo why golden", async () => {
    const run = stageDemo();
    const r = await why(run, ["skill:explain-diff-html"]);
    const golden = readFileSync(join(FIXTURES, "demo-repo", "expected.why-output.txt"), "utf8");
    const posix = (p: string) => p.replaceAll("\\", "/");
    const normalized = posix(r.stdout).replaceAll(posix(run.root), "<ROOT>").replaceAll(posix(run.home), "<HOME>");
    expect(normalized).toBe(golden);
  });

  it("unknown entity: exit 2 with did-you-mean suggestions", async () => {
    const run = stageDemo();
    const r = await why(run, ["explain"]);
    expect(r.exitCode).toBe(2);
    expect(r.stdout + r.stderr).toContain("explain-diff-html");
  });

  it("--json emits the explanation structure", async () => {
    const run = stageDemo();
    const r = await why(run, ["skill:explain-diff-html", "--json"]);
    expect(r.exitCode).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.schema).toBe("devinscope/v1");
    expect(parsed.entity.name).toBe("explain-diff-html");
    expect(parsed.duplicates).toHaveLength(1);
    expect(parsed.diagnostics.map((d: { code: string }) => d.code)).toContain("DUP_SKILL");
    expect(JSON.stringify(parsed)).not.toContain("Summarize the diff briefly"); // no bodies
  });

  it("why without an argument exits 2", async () => {
    const run = stageDemo();
    const r = await execa("node", [CLI, "why"], { cwd: run.root, reject: false });
    expect(r.exitCode) .toBe(2);
  });

  it("explains a plugin with manifest and version", async () => {
    const run = stageDemo();
    const r = await why(run, ["plugin:teamkit"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("WHY: teamkit");
    expect(r.stdout).toContain("Kind: plugin");
    expect(r.stdout).toContain("2.1.0");
  });

  it("explains a hook and surfaces its broken-command diagnostic", async () => {
    const run = stageDemo();
    const r = await why(run, ["hook:PreToolUse:exec"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("WHY: PreToolUse:exec");
    expect(r.stdout).toContain("BROKEN_HOOK_CMD");
    expect(r.stdout).toContain("scripts/filter-context.sh");
  });

  it("explains an unavailable MCP server", async () => {
    const run = stageDemo();
    const r = await why(run, ["mcp:internal-tools"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("WHY: internal-tools");
    expect(r.stdout).toContain("MCP_CMD_MISSING");
  });

  it("explains a rule entity", async () => {
    const run = stageDemo();
    const r = await why(run, ["rule:tests.md"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("WHY: tests.md");
    expect(r.stdout).toContain("Kind: rule");
    expect(r.stdout).toContain("CONFLICT_MODAL");
  });

  it("explains a custom agent", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "devinscope-why-agent-"));
    tmps.push(tmp);
    const root = join(tmp, "project");
    const home = join(tmp, "home");
    mkdirSync(join(root, ".devin", "agents"), { recursive: true });
    mkdirSync(home, { recursive: true });
    writeFileSync(join(root, ".devin", "agents", "reviewer.md"), "---\nname: reviewer\ndescription: Reviews code\n---\nYou review.\n");
    const r = await execa("node", [CLI, "why", "agent:reviewer"], {
      cwd: root,
      env: { DEVINSCOPE_HOME: home },
      reject: false,
      stripFinalNewline: false,
      maxBuffer: 64 * 1024 * 1024,
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("WHY: reviewer");
    expect(r.stdout).toContain("Kind: agent");
  });

  it("why config:permissions matches config files containing that key", async () => {
    const run = stageDemo();
    const r = await why(run, ["config:permissions"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("WHY: permissions");
    expect(r.stdout).toContain("Kind: config");
    // highest-precedence file containing the key headlines (project-local > project)
    expect(r.stdout).toContain(".devin/config.local.json");
  });
});
