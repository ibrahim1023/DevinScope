# Testing Strategy

DevinScope's core is fixture-driven (product-spec §31). Four test tiers, all run by `pnpm verify`:

## 1. Unit tests (`tests/unit/`)

Pure functions: parsers, redaction patterns, modal-directive conflict detection, diff computation, severity ranking. Standard Vitest assertions; no fixtures needed.

## 2. Fixture scenarios (`fixtures/<scenario>/`)

One directory per configuration pattern. Layout:

```
fixtures/duplicate-skills/
├── input/                      # copied to a temp dir at test time
│   ├── .agents/skills/review/SKILL.md
│   └── home/.config/devin/skills/review/SKILL.md   # fake $HOME for global scope
├── expected.graph.json         # normalized RuntimeEntity[] with provenance
├── expected.diagnostics.json   # exact diagnostic codes, severities, evidence
└── expected.output.txt         # optional: golden CLI rendering
```

Rules:
- **Volatile values are normalized before comparison:** absolute paths → `<ROOT>` / `<HOME>`, timestamps → `<TS>`, hashes of file *paths* are stable by construction. Never snapshot raw volatile output (industry best practice; see ADR-0005).
- **Explicit assertions alongside goldens:** each scenario asserts key facts directly (e.g. "2 entities, both `available`, 1 MEDIUM duplicate diagnostic") so goldens can't silently drift semantics.
- Initial corpus (spec §28): `clean-project`, `duplicate-skills`, `broken-hook`, `config-shadowing`, `plugin-conflict`, `broken-mcp`, `conflicting-instructions`, plus `demo-repo` (spec §39).

## 3. CLI contract tests (`tests/cli/`)

Run the built CLI against fixtures via `execa`: exit codes (0/1/2/3 per spec §25), `--json` schema validity (zod), stderr/stdout separation, `--strict` behavior.

## 4. Security canary test (`tests/security/`)

Fixtures seeded with canary secrets (`ghp_CANARY…`, `sk-CANARY…`). Assert no output, snapshot, or debug log contains a canary value — only `configured|missing|redacted` markers.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm test` | all tiers |
| `pnpm test:watch` | TDD loop |
| `pnpm test:golden:update` | regenerate goldens — review the git diff before committing |
| `pnpm verify` | typecheck + lint + tests (CI gate) |

CI matrix: macOS, Linux, Windows on Node 24 (spec §32). CI never updates goldens.
