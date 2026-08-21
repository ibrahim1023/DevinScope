import type { SourceLocation } from "../types.js";

const HOOKS_DOC = "devin-docs:extensibility/hooks/overview.mdx";

/**
 * Hook file locations per Devin CLI docs (hooks/overview.mdx "Where Hooks Live").
 * `.devin/hooks.v1.json` is a bare hooks object; everywhere else hooks sit
 * under the "hooks" key. Hooks are COLLECTED from all sources — all run,
 * no override semantics — so resolutionBasis is "documented" (for that
 * collect-all rule), and resolution never marks hooks shadowed.
 */
export const HOOK_LOCATIONS: SourceLocation[] = [
  { id: "hooks-v1", kind: "hook", scope: "project", base: "project", glob: ".devin/hooks.v1.json", resolutionBasis: "documented", docRef: HOOKS_DOC },
  { id: "hooks-config", kind: "hook", scope: "project", base: "project", glob: ".devin/config.json", resolutionBasis: "documented", docRef: HOOKS_DOC },
  { id: "hooks-config-local", kind: "hook", scope: "project-local", base: "project", glob: ".devin/config.local.json", resolutionBasis: "documented", docRef: HOOKS_DOC },
  { id: "hooks-claude-settings", kind: "hook", scope: "compatibility", base: "project", glob: ".claude/settings.json", resolutionBasis: "documented", docRef: HOOKS_DOC },
  { id: "hooks-claude-settings-local", kind: "hook", scope: "compatibility", base: "project", glob: ".claude/settings.local.json", resolutionBasis: "documented", docRef: HOOKS_DOC },
  { id: "hooks-user-config", kind: "hook", scope: "global", base: "user-config", glob: "config.json", resolutionBasis: "documented", docRef: HOOKS_DOC },
  { id: "hooks-claude-home", kind: "hook", scope: "global", base: "home", glob: ".claude.json", resolutionBasis: "documented", docRef: HOOKS_DOC },
  { id: "hooks-claude-home-settings", kind: "hook", scope: "global", base: "home", glob: ".claude/settings.json", resolutionBasis: "documented", docRef: HOOKS_DOC },
  { id: "hooks-claude-home-settings-local", kind: "hook", scope: "global", base: "home", glob: ".claude/settings.local.json", resolutionBasis: "documented", docRef: HOOKS_DOC },
];
