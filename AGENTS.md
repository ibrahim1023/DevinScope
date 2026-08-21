# AGENTS.md — DevinScope

Deterministic, local-first CLI that reconstructs the effective Devin runtime. TypeScript, ESM-only, Node ≥ 24, pnpm.

## Commands

- `pnpm verify` — **the gate**: typecheck + lint + unit tests + fixture/golden evals. Must pass before claiming any task complete.
- `pnpm test` / `pnpm test:watch` — Vitest.
- `pnpm test:golden:update` — regenerate goldens after an intentional output change; review the diff before committing.
- `pnpm build` — tsdown → `dist/` (single ESM bundle, shebang preserved).

## Non-negotiable product invariants

1. **Deterministic core.** No LLM calls, no network, no background processes in `src/`. Anything semantic is a future opt-in layer (see spec §10).
2. **Never invent hidden state.** Every fact is `known` (observed), `resolved` (documented precedence, cite the doc), or `inferred` (labeled heuristic with confidence). Undocumented precedence → `resolution: "unknown"`.
3. **Never print secrets.** All output and snapshots pass through `src/security/redact.ts`. Secret values render as `configured|missing|redacted`.
4. **CLI is a renderer.** All logic lives in the engine layers (`discovery → runtime → resolution → diagnostics`); `src/cli/` and `src/render/` contain no business logic.
5. **Centralized paths.** No hardcoded Devin paths outside `src/adapters/*/paths.ts`. All home-dir and platform handling goes through `src/platform/`.

## Conventions

- Follow the layer direction: `cli → render → snapshots/diff → diagnostics → resolution → runtime → adapters/parsers → platform`. Never import upward.
- Every discovered item becomes a `RuntimeEntity` with full `Provenance` (see `docs/superpowers/specs/2026-08-21-devinscope-v0.1-design.md`).
- Tests are fixture-driven: one directory per scenario under `fixtures/` with input files + `expected.graph.json` + `expected.diagnostics.json`. Use the `fixture-authoring` skill when adding scenarios.
- Unknown fields in Devin config must not crash the tool; preserve them and emit an INFO diagnostic (spec §30).
- Commits: conventional commits, one task per commit.

## Workflow rules (maintainer directives)

- **Planning:** when a phase or task is unclear or underspecified, use the superpowers `brainstorming` and `writing-plans` skills to clarify and plan before writing code.
- **Implementation:** do NOT use the superpowers execution machinery (subagent-driven-development, executing-plans, worktree ceremony). Implement directly in this session, following the plan's tasks with test-first discipline and `pnpm verify` as the gate.

## Key docs

- Spec: `docs/superpowers/specs/2026-08-21-devinscope-v0.1-design.md`
- Plan: `docs/superpowers/plans/2026-08-21-devinscope-v0.1-doctor-milestone.md`
- Decisions: `docs/decisions/` · Testing: `docs/testing.md` · Evals: `docs/evals.md` · Observability: `docs/observability.md`
