# DevinScope v0.1 — Engineering Design

**Date:** 2026-08-21
**Status:** Approved (approach + toolchain confirmed by maintainer)
**Source of product truth:** the internal product specification (maintainer-private, not published to this repo). This document records *how* we build it, not *what* it is. Where the two disagree, the product spec wins and this doc is updated.

---

## 1. Architecture (Approach A — approved)

Single-package, ESM-only, unidirectional layered kernel. The normalized runtime graph is the core primitive; the CLI is a renderer over it (spec §14).

```
src/
├── cli/          # commander wiring, exit codes, flag parsing — no logic
├── render/       # terminal + JSON renderers over graphs/diagnostics/diffs
├── snapshots/    # snapshot schema, save/load/list, redacted persistence
├── diff/         # graph comparison → DiffReport
├── diagnostics/  # diagnostic classes, severity ranking, evidence
├── resolution/   # precedence + shadowing, evidence-based
├── runtime/      # RuntimeEntity, Provenance, RuntimeGraph (pure data)
├── adapters/     # one per source type; each owns its paths.ts registry
├── parsers/      # jsonc, yaml-frontmatter, plugin manifests, hooks.v1
├── security/     # secret redaction — single chokepoint for all output
└── platform/     # home dir, XDG/%APPDATA%, PATH lookup, project-root walk
```

Import direction is strictly downward; `runtime/` and `platform/` depend on nothing in the package. Rationale and rejected alternatives: [ADR-0001](../../decisions/0001-single-package-esm-only.md).

## 2. Source registry as data

Each adapter owns a versioned `paths.ts` declaring the locations it reads, their scope, and their `resolution` basis. Registry entries cite the Devin doc section they are derived from, so version drift (spec §30) is auditable. See [ADR-0002](../../decisions/0002-source-registry-as-data.md). Initial registry (from Devin CLI docs, Local 3.x):

| Category | Locations |
| --- | --- |
| Instructions | `AGENTS.md`, `AGENTS.local.md`, `AGENT.md`, `.windsurfrules`, `CLAUDE.md` (root + ancestors); `~/.config/devin/AGENTS.md`, `~/.claude/CLAUDE.md`; `.devin/rules/*.md`, `.devin/global_rules.md`, `~/.devin/` equivalents; `.windsurf/`, `.cursor/rules/*` compat |
| Config | `~/.config/devin/config.json`, `.devin/config.json`, `.devin/config.local.json` (JSONC) |
| MCP | `mcp_config.json` at the same three levels; legacy `mcpServers` key pre-v3000.3 |
| Hooks | `.devin/hooks.v1.json`, `hooks` key in configs, `.claude/settings*.json`, `~/.claude.json` |
| Skills | `.devin/skills/`, `.agents/skills/`, `.windsurf/skills/`, `~/.config/devin/skills/`, `~/.agents/skills/`, `~/.codeium/<channel>/skills/` |
| Agents | `.devin/agents/`, `.agents/agents/`, `~/.config/devin/agents/`, `.claude/agents/*.md` |
| Plugins | user-level installs (cache under `~/.local/share/devin/cli/plugins/`), manifests `.devin-plugin/plugin.json` > `.claude-plugin/plugin.json` > root `plugin.json`; repo/user `requiredPlugins` in configs |

Windows: `~/.config/devin/` → `%APPDATA%\devin/`. All path resolution goes through `src/platform/`.

## 3. Resolution engine — evidence-based

Precedence is applied **only where documented** (spec §15, ADR-0003):

- **Config/MCP:** org > session > project-local > project > user; MCP merged by name, higher level wins → `documented-precedence`.
- **Hooks:** collected from all sources, all run, *no* override semantics → duplicates flagged, never shadowed.
- **Skills/agents/instructions:** Devin documents discovery locations but **not** a shadowing order → same-named entities are all reported with `resolution: "unknown"`, status `available`; a MEDIUM duplicate diagnostic is emitted. We do not claim project shadows global.
- Unknown fields never crash; preserved into `metadata`, INFO diagnostic emitted.

## 4. Diagnostics

Severity ladder `INFO < LOW < MEDIUM < HIGH < ERROR` (spec §16). v0.1 classes: structural errors, duplicates, documented shadowing, broken hooks, MCP validity (env var *names* only, never values), conservative modal-directive instruction conflicts (`inferred`, always labeled with confidence). Every diagnostic carries code, evidence (paths + hashes), explanation, and deterministic remediation where one exists.

## 5. Snapshots & diff

`devinscope/v1` JSON schema: deterministic key ordering, stable entity IDs (`<kind>:<scope>:<name>`), SHA-256 content hashes, redacted secrets, static size metrics, no bodies. Stored as `.devinscope/snapshots/<name>.json` (gitignored by our own `.gitignore`; portable by design for issue attachments). Diff compares two snapshots on entity identity and reports added/removed/changed per category (spec §8.4).

## 6. Security

All renderers and the snapshot writer consume a single `redact()` chokepoint ([ADR-0006](../../decisions/0006-no-telemetry-structured-debug-logging.md) covers the observability side). Patterns: env-var values, bearer tokens, API keys, `oauthClientSecret`, `${env:VAR}`/`${file:...}` references are preserved structurally but values are hashed or replaced with `redacted`. CI runs a leak test: fixtures seeded with canary secrets must never appear in any output or snapshot.

## 7. Testing, evals, observability

- **Testing** = fixture-driven golden harness; see [docs/testing.md](../../testing.md) and [ADR-0005](../../decisions/0005-fixture-golden-eval-harness.md).
- **Evals** = the fixture corpus run as a scored gate; see [docs/evals.md](../../evals.md). No LLM evals — the product is deterministic.
- **Observability** = `--verbose`/`--debug` structured stderr logs and the `--json` output contract; no telemetry, no OTel; see [docs/observability.md](../../observability.md).

## 8. Toolchain (confirmed with maintainer)

TypeScript strict, ESM-only, Node ≥ 24 (`engines`, `.nvmrc`), pnpm, **tsdown** build ([ADR-0004](../../decisions/0004-tsdown-over-tsup.md) — tsup is unmaintained), Vitest, commander + zod + yaml + picocolors + fast-glob. No runtime framework. npm distribution via `bin`, `files` allowlist, trusted publishing + provenance from GitHub Actions.

## 9. Research summary (2026-08-21)

**Sources consulted:**
- Devin CLI docs (on-disk, Local 3.x): `extensibility/configuration.mdx`, `reference/configuration/global-vs-local.mdx`, `extensibility/skills/overview.mdx`, `extensibility/hooks/overview.mdx`, `extensibility/mcp/configuration.mdx`, `extensibility/plugins/overview.mdx`, `extensibility/rules.mdx`, `subagents.mdx`, `troubleshooting.mdx`, `changelog/stable.mdx`
- unjs/citty, cacjs/cac, arcanis/clipanion READMEs; "Best CLI Frameworks for Node.js in 2026" (PkgPulse); "Building and Shipping Node.js CLI Tools" (Nazar Boyko)
- rolldown/tsdown migration guide; egoist/tsup README (deprecation notice); PkgPulse "tsup vs tsdown vs unbuild 2026"; "How to publish an npm package the right way in 2026" (toolchew)
- npm docs: trusted publishing, provenance statements; safeguard.sh npm security guides (files allowlist, token hygiene)
- Vitest snapshot docs incl. `toMatchFileSnapshot`; cronn/file-snapshots; snapshot best-practice guides
- open-telemetry/semantic-conventions-genai repo + stability analysis (john-hodge.com, July 2026); josenobile.co LLM observability guide

**Adopted practices:** adapter-per-source with a data-driven path registry; evidence-labeled resolution (`known/resolved/inferred`); single redaction chokepoint + canary-secret CI test; fixture corpus as eval gate with file snapshots; structured debug logging with stable event names; npm trusted publishing with provenance; ESM-only Node-24 floor; ADRs in Nygard format; centralized platform/path layer for cross-platform CI (macOS/Linux/Windows).

**Rejected practices (with reason):**
- *OTel GenAI semantic conventions / Langfuse-style tracing* — conventions are Development-status with no stable release; zero value for a deterministic local CLI with a no-telemetry principle.
- *LLM-as-judge evals, promptfoo-style model eval harness* — product output is deterministic; fixtures give exact assertions. Revisit only if `--semantic` (spec §10) ships.
- *Monorepo core/CLI split (Approach B)* — no consumer for a standalone engine package; spec's plugin shells out to the CLI.
- *oclif / Ink / session TUI* — framework weight and interactivity are explicitly out of scope (spec §9).
- *tsup* — officially unmaintained; tsdown chosen (ADR-0004).
- *Snapshot-testing volatile fields* — goldens exclude timestamps/absolute paths via normalization (docs/testing.md).
- *Automatic config repair/rewriting* — non-goal (spec §36).

## 10. Milestones

M1 (this plan): scaffold + runtime kernel + `doctor` — first end-to-end usable milestone (spec §42 phases 1–2). M2: `why`. M3: snapshots + diff. M4: release polish. Each gets its own implementation plan.
