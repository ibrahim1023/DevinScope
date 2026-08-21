# DevinScope

> Devin now has skills, plugins, hooks, MCPs, subagents, instructions, and multiple configuration scopes.
>
> When it behaves strangely, one question gets surprisingly difficult:
>
> **What is actually influencing Devin?**
>
> DevinScope reconstructs the effective Devin runtime, shows where every configuration source came from, and flags duplicate skills, broken hooks, unavailable MCPs, and conflicting instructions.

**`git diff` for your Devin environment.**

```bash
npx devinscope doctor
```

> **Status:** pre-v0.1 — under active development. See the [implementation plan](docs/superpowers/plans/2026-08-21-devinscope-v0.1-doctor-milestone.md). The CLI is not yet published to npm.

---

## What it does

DevinScope answers the debugging question *"why is Devin behaving this way?"* with four deterministic, local-first commands:

| Command | Question it answers |
| --- | --- |
| `devinscope doctor` | Is my Devin environment configured coherently? Severity-ranked diagnostics for duplicates, broken hooks, unavailable MCPs, shadowing, and conservative instruction conflicts. |
| `devinscope why <thing>` | Why is this skill/plugin/hook/MCP/agent/rule relevant here? Source path, scope, provenance, duplicates, and what shadows (or is shadowed by) it. |
| `devinscope snapshot` | Record the effective runtime in a portable, redacted, schema-versioned JSON file. |
| `devinscope diff <a> <b>` | What changed between two runtime snapshots — added/removed/changed entities, new and resolved conflicts, instruction-footprint deltas. |

Every entity carries **provenance**: what it is, where it came from, what scope it belongs to, why it is considered active, what it shadows, and what shadows it.

## Principles

- **Deterministic first.** No LLM, no network, no hosted backend. Facts come from local files and documented Devin configuration semantics.
- **Never invent hidden state.** Every claim is labeled `known` (observed), `resolved` (documented precedence), or `inferred` (conservative heuristic). DevinScope never claims to reconstruct Devin's system prompt or model reasoning.
- **Local by default.** Nothing leaves the machine. Snapshots redact secrets and store content hashes, not bodies.
- **Useful before something breaks.** Run `doctor` before a session, not only after a failure.

## What it is not

DevinScope is not a session monitor (that's CTOP), not a trace viewer (that's Trajectory), not a session analyzer (that's Session Insights), and not a skill evaluator. It answers *what environment is shaping the session*, not *what happened inside it*.

## Install & run (once published)

```bash
npx devinscope doctor            # human-readable report
npx devinscope doctor --json     # machine-readable
npx devinscope doctor --strict   # exit 1 on HIGH/ERROR diagnostics

npx devinscope why skill:explain-diff-html
npx devinscope snapshot save baseline
npx devinscope diff baseline current
```

Exit codes: `0` clean · `1` high/error diagnostics · `2` invalid invocation · `3` discovery failure.

## Development

Requires Node.js ≥ 24 and pnpm.

```bash
pnpm install
pnpm verify        # typecheck + lint + tests + golden fixtures — the full gate
pnpm test          # vitest
pnpm build         # tsdown → dist/
```

See [AGENTS.md](AGENTS.md) for contributor conventions, [docs/testing.md](docs/testing.md) for the fixture-driven test strategy, and [docs/decisions/](docs/decisions/) for architecture decision records.

## License

[MIT](LICENSE)
