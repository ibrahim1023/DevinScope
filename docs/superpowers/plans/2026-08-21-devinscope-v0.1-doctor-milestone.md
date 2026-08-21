# DevinScope v0.1 Milestone 1 — Runtime Kernel + `doctor` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npx devinscope doctor` runs against a real repository and produces a severity-ranked, provenance-preserving diagnostics report (human + `--json`), proven green by the fixture corpus.

**Architecture:** Single-package ESM-only layered kernel (ADR-0001). Unidirectional layers: `cli → render → diagnostics → resolution → runtime → adapters/parsers → platform`. The runtime graph is pure data; the CLI renders it. This plan covers spec §42 Phases 1–2 only; `why`, snapshots/diff, and release polish get their own plans.

**Tech Stack:** TypeScript strict · Node ≥ 24 · pnpm · tsdown · Vitest · commander · zod · yaml · picocolors · fast-glob

**Spec:** [docs/superpowers/specs/2026-08-21-devinscope-v0.1-design.md](../specs/2026-08-21-devinscope-v0.1-design.md) (engineering design) and [product-spec.md](../../../product-spec.md) (product truth).

## Global Constraints

- Node.js **>= 24** (`engines`, `.nvmrc`); ESM-only (`"type": "module"`); package manager **pnpm**.
- No LLM calls, no network, no background daemons, no telemetry anywhere in `src/`.
- Every entity is a `RuntimeEntity` with full `Provenance`; undocumented precedence → `resolution: "unknown"` (ADR-0003).
- No secret values in any output: everything rendered or persisted passes `redactText`/`redactValue` (spec §23).
- No Devin paths hardcoded outside `src/adapters/*/paths.ts`; platform/home-dir logic only in `src/platform/` (ADR-0002).
- Unknown config fields never crash the tool: preserve into `metadata`, emit INFO diagnostic (spec §30).
- Exit codes: `0` clean, `1` HIGH/ERROR present, `2` invalid invocation, `3` discovery failure (spec §25).
- License MIT; conventional commits; one task per commit.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.nvmrc`, `pnpm-workspace.yaml` (absent — single package; do NOT create)

**Interfaces:**
- Produces: pnpm scripts `build`, `test`, `test:watch`, `test:golden:update`, `verify`, `eval`; bin entry `devinscope → dist/cli.js`.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "devinscope",
  "version": "0.1.0",
  "description": "See the Devin environment that actually runs — runtime and configuration devtools for Devin.",
  "type": "module",
  "license": "MIT",
  "bin": { "devinscope": "dist/cli.js" },
  "files": ["dist", "README.md", "LICENSE"],
  "engines": { "node": ">=24" },
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:golden:update": "vitest run -u",
    "eval": "vitest run --project evals",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm eval"
  },
  "dependencies": {
    "commander": "^14.0.0",
    "fast-glob": "^3.3.3",
    "picocolors": "^1.1.1",
    "yaml": "^2.8.0",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "eslint": "^9.33.0",
    "execa": "^9.6.0",
    "tsdown": "^0.23.0",
    "typescript": "^5.9.0",
    "vitest": "^4.0.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json** — strict, `module: "nodenext"`, `target: "es2024"`, `exactOptionalPropertyTypes: true`, `verbatimModuleSyntax: true`, `outDir: "dist"`, `include: ["src", "tests"]`.
- [ ] **Step 3: Write tsdown.config.ts**

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli/index.ts"],
  format: ["esm"],
  dts: false,
  minify: false,
  banner: { js: "#!/usr/bin/env node" },
  outExtensions: () => ({ js: ".js" }),
});
```

- [ ] **Step 4: Write vitest.config.ts** — two projects: `unit` (`tests/**`) and `evals` (`tests/evals/**`, single-threaded).
- [ ] **Step 5: Write eslint.config.js** — typescript-eslint recommended + `no-restricted-imports` enforcing layer direction (cli may not import from adapters/parsers/platform; runtime imports nothing in-package; etc., per ADR-0001).
- [ ] **Step 6: `.nvmrc` = `24`; run `pnpm install`; commit**

```bash
pnpm install && pnpm typecheck
git add -A && git commit -m "chore: scaffold devinscope package (ESM, Node 24, tsdown, vitest)"
```

---

### Task 2: Platform layer

**Files:**
- Create: `src/platform/index.ts`, `src/platform/platform.test.ts` → move tests under `tests/unit/platform.test.ts`

**Interfaces:**
- Produces (everything downstream depends on these):

```ts
export interface PlatformPaths {
  homeDir(): string;
  devinUserConfigDir(): string;   // ~/.config/devin or %APPDATA%\devin
  codeiumChannelsDir(): string;   // ~/.codeium
  devinLocalStateDir(): string;   // ~/.local/share/devin (plugin cache, logs)
  findProjectRoot(start: string): string | null; // walk up for .git / .jj
  executableExists(command: string): boolean;    // PATH lookup, cross-platform
}
export function createPlatform(overrides?: { homeDir?: string }): PlatformPaths;
```

- [ ] **Step 1: Write failing test** `tests/unit/platform.test.ts`: `createPlatform({ homeDir: "/fake" }).devinUserConfigDir()` returns `/fake/.config/devin` on posix; `findProjectRoot` finds ancestor with `.git`; `executableExists("node")` is true, `executableExists("definitely-not-a-real-binary-xyz")` is false.
- [ ] **Step 2: Run `pnpm vitest run tests/unit/platform.test.ts` → FAIL (module missing).**
- [ ] **Step 3: Implement** `src/platform/index.ts`: `os.homedir()` / override; `process.platform === "win32"` → `%APPDATA%\devin`; walk-up loop for `.git`/`.jj`; PATH scan honoring `PATHEXT` on Windows.
- [ ] **Step 4: Test passes. Commit** `feat(platform): home dir, XDG/APPDATA, project-root walk, PATH lookup`.

---

### Task 3: Core runtime types

**Files:**
- Create: `src/runtime/types.ts`, `src/runtime/graph.ts`, `tests/unit/graph.test.ts`

**Interfaces:**
- Produces (used by every later task — exact shapes, from spec §12–13):

```ts
export type RuntimeEntityKind = "instruction" | "rule" | "skill" | "hook" | "plugin" | "agent" | "mcp" | "config";
export type RuntimeScope = "global" | "project" | "project-local" | "plugin" | "compatibility" | "session" | "unknown";
export type RuntimeStatus = "active" | "available" | "shadowed" | "disabled" | "invalid" | "unknown";
export type Resolution = "direct" | "documented-precedence" | "heuristic" | "unknown";
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "ERROR";

export interface Provenance {
  sourceType: "filesystem" | "plugin" | "global-config" | "project-config" | "local-state" | "derived";
  sourcePath?: string;
  pluginName?: string;
  resolution: Resolution;
  docRef?: string;            // citation for documented-precedence claims
  overriddenBy?: string[];
  overrides?: string[];
}

export interface RuntimeEntity {
  id: string;                 // `${kind}:${scope}:${name}`
  kind: RuntimeEntityKind;
  name: string;
  sourcePath?: string;
  scope: RuntimeScope;
  status: RuntimeStatus;
  provenance: Provenance;
  contentHash?: string;       // sha256 hex of file content
  metadata: Record<string, unknown>;
}

export interface Diagnostic {
  code: string;               // e.g. "DUP_SKILL"
  title: string;
  severity: Severity;
  entityIds: string[];
  evidence: string[];         // normalized paths / hashes, never secret values
  explanation: string;
  remediation?: string;
}

export interface RuntimeGraph {
  schema: "devinscope/v1";
  root: string;
  entities: RuntimeEntity[];  // sorted by id, deterministic
  diagnostics: Diagnostic[];  // sorted by severity desc, then code
  metrics: { instructionBytes: number; fileCount: number };
}
```

`graph.ts` exports `entityId(kind, scope, name)`, `sha256(content)`, `sortGraph(graph)` (deterministic ordering per spec §22), `emptyGraph(root)`.

- [ ] **Step 1: Failing test** `tests/unit/graph.test.ts`: `entityId("skill","project","review") === "skill:project:review"`; `sortGraph` orders entities by id and diagnostics by severity; `sha256("abc")` equals known digest `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
- [ ] **Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(runtime): core entity, provenance, diagnostic, graph types`.

---

### Task 4: Parsers

**Files:**
- Create: `src/parsers/jsonc.ts`, `src/parsers/frontmatter.ts`, `tests/unit/parsers.test.ts`

**Interfaces:**
- Produces:

```ts
export type ParseResult<T> =
  | { ok: true; value: T; unknownFields: string[] }
  | { ok: false; error: string };
export function parseJsonc(text: string): ParseResult<Record<string, unknown>>;
export function parseSkillFrontmatter(text: string): ParseResult<{ name: string; description?: string; body: string; raw: Record<string, unknown> }>;
```

- [ ] **Step 1: Failing tests**: JSONC with comments + trailing commas parses; malformed JSON returns `ok: false` with line info; SKILL.md frontmatter (`yaml` lib) extracts name/description/body; unknown frontmatter keys land in `raw` and `unknownFields`.
- [ ] **Step 2: Run → FAIL. Step 3: Implement** (JSONC: strip comments/trailing commas with a tolerant tokenizer — do NOT use `eval`; frontmatter: `---`-fenced YAML via `yaml`). **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(parsers): tolerant jsonc + skill frontmatter parsing`.

---

### Task 5: Secret redaction chokepoint

**Files:**
- Create: `src/security/redact.ts`, `tests/unit/redact.test.ts`

**Interfaces:**
- Produces (single chokepoint per spec §23; all renderers/snapshots/logs MUST call these):

```ts
export type SecretState = "configured" | "missing" | "redacted";
export function redactText(input: string): string;           // replaces secret-looking values with "<redacted>"
export function redactEnv(env: Record<string, string>): Record<string, SecretState>;
export const SECRET_PATTERNS: RegExp[];                      // ghp_*, sk-*, xox*, Bearer ..., *_TOKEN/KEY/SECRET assignments, oauthClientSecret
```

- [ ] **Step 1: Failing tests**: `redactText("GITHUB_TOKEN=ghp_CANARY123")` contains no canary; `redactEnv({ GITHUB_TOKEN: "x", EMPTY: "" })` → `{ GITHUB_TOKEN: "configured", EMPTY: "missing" }`; `${env:VAR}` and `${file:...}` references are preserved structurally (not redacted as values).
- [ ] **Step 2: Run → FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(security): redaction chokepoint with canary-tested patterns`.

---

### Task 6: Adapter interface + instruction adapter

**Files:**
- Create: `src/adapters/types.ts`, `src/adapters/instructions/paths.ts`, `src/adapters/instructions/index.ts`, `tests/unit/adapters-instructions.test.ts`

**Interfaces:**
- Produces (spec §29):

```ts
export interface DiscoveryContext {
  root: string;
  homeDir: string;
  platform: PlatformPaths;    // from Task 2
  readFile(absPath: string): Promise<string | null>;
}
export interface SourceLocation {
  id: string; scope: RuntimeScope; glob: string;
  resolutionBasis: "direct" | "documented" | "undocumented";
  docRef: string;             // e.g. "devin-docs:extensibility/rules.mdx"
}
export interface SourceAdapter {
  id: string;
  detect(ctx: DiscoveryContext): Promise<boolean>;
  discover(ctx: DiscoveryContext): Promise<RuntimeEntity[]>;
  validate?(entities: RuntimeEntity[]): Promise<Diagnostic[]>;
}
```

- [ ] **Step 1: Write `paths.ts`** as data: entries for `AGENTS.md`, `AGENTS.local.md`, `AGENT.md`, `.windsurfrules`, `CLAUDE.md` (root walk), `~/.config/devin/AGENTS.md`, `~/.claude/CLAUDE.md`, `.devin/rules/*.md`, `.devin/global_rules.md`, `~/.devin/*`, `.windsurf/`, `.cursor/rules/*` — each with `docRef` citing the rules doc.
- [ ] **Step 2: Failing test**: temp dir with root `AGENTS.md` + `.devin/rules/style.md` → 2 entities, kinds `instruction`/`rule`, scopes `project`, `provenance.resolution === "direct"`, content hashes set.
- [ ] **Step 3: Run → FAIL. Step 4: Implement adapter** using `fast-glob` over registry entries + ctx.readFile. **Step 5: PASS.**
- [ ] **Step 6: Commit** `feat(adapters): adapter interface + instruction/rule adapter`.

---

### Task 7: Skill adapter

**Files:**
- Create: `src/adapters/skills/paths.ts`, `src/adapters/skills/index.ts`, `tests/unit/adapters-skills.test.ts`

**Interfaces:**
- Consumes: `SourceAdapter`, `DiscoveryContext`, `parseSkillFrontmatter` (Task 4).
- Produces: `SkillAdapter` — entities kind `skill`, metadata `{ description, bodyChars, supportingFiles: number }`.

- [ ] **Step 1: `paths.ts`**: `.devin/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md`, `.windsurf/skills/*/SKILL.md`, `~/.config/devin/skills/*/SKILL.md`, `~/.agents/skills/*/SKILL.md`, `~/.codeium/{windsurf,windsurf-next,windsurf-insiders}/skills/*/SKILL.md` — scopes `project`/`global`, `resolutionBasis: "undocumented"` (ADR-0003), docRef to skills overview doc.
- [ ] **Step 2: Failing test**: two same-named skills (project + fake home global) → 2 entities, both `status: "available"`, `resolution: "unknown"`; malformed frontmatter → entity `status: "invalid"` + parse diagnostic evidence in metadata.
- [ ] **Step 3: Run → FAIL. Step 4: Implement** (count supporting files via fast-glob in skill dir). **Step 5: PASS.**
- [ ] **Step 6: Commit** `feat(adapters): skill discovery across all documented locations`.

---

### Task 8: Hook adapter

**Files:**
- Create: `src/adapters/hooks/paths.ts`, `src/adapters/hooks/index.ts`, `tests/unit/adapters-hooks.test.ts`

**Interfaces:**
- Produces: `HookAdapter` — kind `hook`, name `<event>:<matcher|*>`, metadata `{ event, matcher, type, command?, timeout? }`. Validation emits `BROKEN_HOOK_CMD` (HIGH) when a `command` hook's script path is unresolvable or executable missing from PATH (via `platform.executableExists`), `INVALID_HOOK_MATCHER` (MEDIUM) when regex fails to compile.

- [ ] **Step 1: `paths.ts`**: `.devin/hooks.v1.json` (whole file is hooks object), `hooks` key in `.devin/config.json` / `.devin/config.local.json` / `~/.config/devin/config.json`, `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude.json`, `~/.claude/settings*.json` — docRef to hooks overview doc.
- [ ] **Step 2: Failing tests**: fixture with `hooks.v1.json` referencing `./scripts/missing.sh` → `BROKEN_HOOK_CMD` HIGH with evidence path; bad regex matcher → `INVALID_HOOK_MATCHER`; valid setup → entities for each event with provenance. Hooks are *collected*, never shadowed (doc: "all run").
- [ ] **Step 3: Run → FAIL. Step 4: Implement. Step 5: PASS.**
- [ ] **Step 6: Commit** `feat(adapters): hook discovery + broken-reference validation`.

---

### Task 9: MCP adapter

**Files:**
- Create: `src/adapters/mcp/paths.ts`, `src/adapters/mcp/index.ts`, `tests/unit/adapters-mcp.test.ts`

**Interfaces:**
- Produces: `McpAdapter` — kind `mcp`, metadata `{ transport: "stdio"|"http"|"sse", command?|url?, env: Record<string, SecretState>, disabled?: boolean }` — **env values via `redactEnv` only**. Documented precedence: project-local > project > user, merged by name → `resolution: "documented-precedence"`, `docRef: "devin-docs:reference/configuration/global-vs-local.mdx"`. Legacy `mcpServers` key in `config.json` (pre-v3000.3) discovered with INFO diagnostic `MCP_LEGACY_LOCATION`. Validation: `MCP_MISSING_ENV` (MEDIUM, `$env:VAR` refs + required-looking env names absent), `MCP_BAD_URL` (MEDIUM), `MCP_CMD_MISSING` (HIGH), duplicate names across levels → overridden entity `status: "shadowed"` (documented).

- [ ] **Step 1: `paths.ts`**: `mcp_config.json` at user/project/project-local + legacy `mcpServers` in `config.json` files.
- [ ] **Step 2: Failing tests**: same-named server in project + user → project `active`, user `shadowed` with `overriddenBy`; `env: { API_KEY: "ghp_x" }` never appears in metadata (only `configured`); `disabled: true` → `status: "disabled"`; bad URL → diagnostic.
- [ ] **Step 3: Run → FAIL. Step 4: Implement. Step 5: PASS.**
- [ ] **Step 6: Commit** `feat(adapters): MCP discovery with documented name-merge precedence + redacted env`.

---

### Task 10: Config adapter

**Files:**
- Create: `src/adapters/config/paths.ts`, `src/adapters/config/index.ts`, `tests/unit/adapters-config.test.ts`

**Interfaces:**
- Produces: `DevinConfigAdapter` — kind `config` entities for each config file + `permissions`/`read_config_from` summaries in metadata (values redacted where sensitive). Unknown top-level keys → INFO `UNKNOWN_FIELD` (spec §30). Project-level files containing user-only keys (`agent`, `theme_mode`, …) → LOW `MISPLACED_SETTING` (documented as user-config-only).

- [ ] **Step 1: Failing tests**: `.devin/config.json` with `{ "agent": {...}, "customNewField": 1 }` → LOW `MISPLACED_SETTING` + INFO `UNKNOWN_FIELD`, field preserved in metadata; invalid JSONC → `INVALID_JSON` ERROR, adapter continues with other files (spec §30 rule 1).
- [ ] **Step 2: Run → FAIL. Step 3: Implement (zod schema with `.passthrough()` semantics via unknownFields capture). Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(adapters): devin config discovery, unknown-field tolerance, misplaced-setting detection`.

---

### Task 11: Plugin + agent adapters

**Files:**
- Create: `src/adapters/plugins/paths.ts`, `src/adapters/plugins/index.ts`, `src/adapters/agents/paths.ts`, `src/adapters/agents/index.ts`, `tests/unit/adapters-plugins.test.ts`, `tests/unit/adapters-agents.test.ts`

**Interfaces:**
- Produces: `PluginAdapter` — kind `plugin`, reads install cache under `platform.devinLocalStateDir()/cli/plugins/` + repo/user `requiredPlugins` from configs; manifest precedence `.devin-plugin/plugin.json` > `.claude-plugin/plugin.json` > root `plugin.json`; counts contributed skills/agents/hooks/MCPs into metadata; missing manifest → `PLUGIN_NO_MANIFEST` LOW. `AgentAdapter` — kind `agent` from `.devin/agents/`, `.agents/agents/`, `~/.config/devin/agents/`, `.claude/agents/*.md`; flat `<name>.md` and `<name>/AGENT.md` layouts; name conflicts with built-ins (`subagent_explore`, `subagent_general`) → MEDIUM `AGENT_BUILTIN_CONFLICT` (documented skip-with-warning behavior).

- [ ] **Step 1: Failing tests** for both adapters covering the above. **Step 2: Run → FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(adapters): plugin cache inspection + custom subagent discovery`.

---

### Task 12: Resolution engine

**Files:**
- Create: `src/resolution/index.ts`, `tests/unit/resolution.test.ts`

**Interfaces:**
- Consumes: `RuntimeEntity[]` from all adapters.
- Produces:

```ts
export function resolveEntities(entities: RuntimeEntity[]): RuntimeEntity[];
```

Rules (ADR-0003): group by `(kind, name)`. `mcp`/`config`: apply documented level order (project-local > project > global), winner `active`, losers `shadowed` with `overriddenBy`/`overrides` and `resolution: "documented-precedence"` + docRef. `hook`: no resolution — all `active` (documented collect-all). `skill`/`agent`/`instruction`/`rule`: all `available`, `resolution: "unknown"`, duplicate groups cross-linked via `metadata.duplicateOf: string[]`. Never invent order.

- [ ] **Step 1: Failing tests**: MCP shadowing case; duplicate skills stay un-resolved but cross-linked; hooks from 3 sources all active.
- [ ] **Step 2: Run → FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(resolution): evidence-based precedence engine`.

---

### Task 13: Diagnostics engine

**Files:**
- Create: `src/diagnostics/index.ts`, `src/diagnostics/duplicates.ts`, `src/diagnostics/conflicts.ts`, `tests/unit/diagnostics.test.ts`

**Interfaces:**
- Produces:

```ts
export function runDiagnostics(graph: RuntimeGraph): Diagnostic[];
```

Aggregates adapter `validate()` diagnostics plus: duplicates (`DUP_SKILL`/`DUP_MCP`/`DUP_HOOK`/`DUP_AGENT`, MEDIUM) from resolution cross-links; documented shadowing summary (INFO); conservative modal-directive conflicts (`CONFLICT_MODAL`, MEDIUM, `resolution: "heuristic"`, `confidence: "medium"` in evidence) — extract sentences containing `always|never|must|must not|only|do not|required|forbidden` from active instruction/rule entities, flag pairs with opposing polarity sharing ≥1 content keyword.

- [ ] **Step 1: Failing tests**: "Always run the complete test suite." vs "Only run tests directly affected by the change." → one `CONFLICT_MODAL` with both entity IDs and quoted evidence; same-modality sentences → no diagnostic; duplicate group → correct code + severity ordering.
- [ ] **Step 2: Run → FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(diagnostics): duplicates, shadowing summaries, conservative conflict detection`.

---

### Task 14: Fixture harness + initial corpus

**Files:**
- Create: `tests/fixtures/harness.ts`, `fixtures/clean-project/**`, `fixtures/duplicate-skills/**`, `fixtures/broken-hook/**`, `fixtures/config-shadowing/**`, `fixtures/plugin-conflict/**`, `fixtures/broken-mcp/**`, `fixtures/conflicting-instructions/**`, `tests/evals/corpus.test.ts`

**Interfaces:**
- Produces:

```ts
export async function runFixture(name: string): Promise<{ graph: RuntimeGraph; tmp: string }>;
export function normalizeGraph(graph: RuntimeGraph, tmp: string): RuntimeGraph; // <ROOT>/<HOME>/<TS> normalization
```

Each fixture has `input/` (with `input/home/` mapped to fake `$HOME`), `expected.graph.json`, `expected.diagnostics.json`, `NOTES.md` citing doc sources. Use the `fixture-authoring` skill checklist.

- [ ] **Step 1: Failing corpus test** `tests/evals/corpus.test.ts`: for each fixture dir, run discovery→resolution→diagnostics, normalize, compare to expected files; plus explicit per-scenario assertions (counts, severities).
- [ ] **Step 2: Run → FAIL (fixtures missing). Step 3: Author the 7 fixtures. Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `test: fixture harness + initial 7-scenario corpus`.

---

### Task 15: Renderers + `doctor` command

**Files:**
- Create: `src/render/doctor.ts`, `src/render/json.ts`, `src/cli/index.ts`, `tests/cli/doctor.test.ts`, `fixtures/clean-project/expected.output.txt`

**Interfaces:**
- Produces:

```ts
export function renderDoctor(graph: RuntimeGraph, opts: { color: boolean }): string;
export function renderJson(graph: RuntimeGraph): string; // redacted, schema "devinscope/v1"
```

CLI (commander): `devinscope doctor [--json] [--strict] [--verbose] [--debug]`. Terminal output: diagnostics grouped by severity (ERROR→INFO, picocolors), then entity summary counts by kind/scope, then instruction-footprint bytes. Exit codes per Global Constraints. `--strict` → exit 1 on HIGH/ERROR. All output via Task-5 redaction. Debug logs (structured JSON lines, stderr) via a tiny `src/platform/log.ts` with stable event names from docs/observability.md.

- [ ] **Step 1: Failing CLI test** (execa against built CLI on `clean-project` + `broken-hook` fixtures): exit 0 vs 1, `--json` parses + matches zod schema, golden `expected.output.txt` matches with `<ROOT>` normalization, canary secret absent from all streams.
- [ ] **Step 2: Run → FAIL. Step 3: Implement renderers + CLI. Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(cli): doctor command with terminal + JSON renderers and exit codes`.

---

### Task 16: Eval reporter + CI

**Files:**
- Create: `tests/evals/reporter.ts`, `.github/workflows/ci.yml`, `fixtures/demo-repo/**`

**Interfaces:**
- Produces: `pnpm eval` score report (per-scenario pass/fail + per-diagnostic-class precision/recall over corpus expectations); CI matrix macos/linux/windows × Node 24 running `pnpm verify`; `demo-repo` fixture per spec §39 (global instructions, project AGENTS.md, one plugin, two same-named skills, one local override, one broken hook, one conflicting rule, one unavailable MCP).

- [ ] **Step 1: Failing eval test**: reporter on a synthetic pass/fail set computes precision/recall correctly.
- [ ] **Step 2: Run → FAIL. Step 3: Implement reporter + author demo-repo fixture + workflow file. Step 4: `pnpm verify` green locally.**
- [ ] **Step 5: Commit** `test: eval score reporter, demo-repo dogfood fixture, CI matrix`.

---

## Self-Review Notes (run 2026-08-21)

- **Spec coverage:** M1 covers spec §8.1 (doctor), §11–17 (registry/graph/resolution/diagnostics), §22–23 (snapshot *format* deferred to M3; redaction here), §25, §28–34. `why` (§8.2), snapshots/diff (§8.3–8.4), release polish (§42 Phase 5) are explicitly M2–M4 plans.
- **Placeholders:** none — every code step contains real code or exact file lists.
- **Type consistency:** `RuntimeEntity`/`Provenance`/`Diagnostic`/`Severity` defined once in Task 3 and referenced unchanged in Tasks 6–15; `PlatformPaths` (Task 2) consumed by Tasks 6, 8, 9, 11; `redactEnv`/`redactText` (Task 5) consumed by Tasks 9, 15; `entityId`/`sortGraph` used by resolution and renderers.

## Next milestone

M2 (`why`), M3 (snapshots + diff), M4 (release: npm trusted publishing + provenance, README GIF, packaging audit via `npm pack --dry-run`). Each gets its own plan after M1 lands.
