# Observability

DevinScope is a local, deterministic, privacy-first CLI (product-spec §34). Observability here means **the user can see what the tool did and why** — not shipping data anywhere. No telemetry, no OpenTelemetry, no external SDKs (ADR-0006).

## 1. Structured debug logging

`--verbose` / `--debug` (or `DEVINSCOPE_LOG=debug`) emit single-line JSON to **stderr**; stdout stays clean for piping and `--json`.

```json
{"ts":"2026-08-21T16:00:00Z","level":"debug","event":"adapter.found","adapter":"skill","path":".devin/skills/review/SKILL.md","scope":"project","ms":3}
{"ts":"2026-08-21T16:00:00Z","level":"info","event":"diagnostic.emitted","code":"DUP_SKILL","severity":"MEDIUM","entities":["skill:project:review","skill:global:review"]}
```

Stable event names: `discovery.start`, `discovery.complete`, `adapter.detect`, `adapter.found`, `adapter.error`, `parse.error`, `resolve.entity`, `diagnostic.emitted`, `snapshot.write`, `redact.applied`. Event names are part of the compatibility surface — changes are noted in the changelog.

All log lines pass through `src/security/redact.ts`. `--debug` may include file *paths and sizes*, never secret values.

## 2. The `--json` output contract

Every command's `--json` output is schema-versioned (`"schema": "devinscope/v1"`) and validated by golden tests. This is the machine-consumable observability surface for editor integrations, CI (`doctor --strict --json`), and the future Devin plugin (product-spec §35).

## 3. Diagnostics as user-facing observability

The `doctor` report itself is the primary observability artifact: severity-ranked, evidence-bearing (paths + content hashes), with deterministic remediation. Snapshots extend this over time (`diff`).

## 4. What we deliberately do not do

- No background daemon, no file watchers, no persistent process (spec §33).
- No anonymous usage telemetry; if ever proposed, it is explicit opt-in and a new ADR.
- No OTel/GenAI tracing — the conventions are Development-status with no stable release and provide zero value for deterministic local runs (ADR-0006). Revisit only for the opt-in `--semantic` mode.
