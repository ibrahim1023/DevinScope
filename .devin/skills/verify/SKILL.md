---
name: verify
description: Run the full DevinScope verification gate and fix failures before claiming work complete. Use before any commit, PR, or "done" claim.
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

# Verification loop

DevinScope's gate is `pnpm verify` (typecheck + lint + unit tests + fixture/golden evals). Never claim a task is complete without evidence it passes.

## Loop

1. Run `pnpm verify`. Capture the output.
2. If green: report the exact command output summary (e.g. "34 tests, 8/8 fixtures green") — never an unqualified "tests pass".
3. If red, fix in this order:
   - **Typecheck errors** first (they poison everything downstream).
   - **Lint errors** — especially layer-direction violations (see AGENTS.md §Conventions); never silence a boundary rule without an ADR.
   - **Unit test failures** — fix the code, not the test, unless the spec changed.
   - **Golden/fixture mismatches** — run `pnpm test:golden:update` ONLY if the output change is intentional; then `git diff` the goldens and show the diff to your human partner before committing.
4. Re-run `pnpm verify`. Repeat until green.
5. Only then commit.

## Product invariants to check while fixing

- No secret values in any output/log/snapshot — canary tests must stay green.
- No `shadowed` status without a documented-precedence citation (ADR-0003).
- No new hardcoded Devin paths outside `src/adapters/*/paths.ts` (ADR-0002).
- No network calls, LLM calls, or background processes in `src/`.
