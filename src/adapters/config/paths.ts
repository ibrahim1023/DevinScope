import type { SourceLocation } from "../types.js";

const CONFIG_DOC = "devin-docs:extensibility/configuration.mdx";
const PRECEDENCE_DOC = "devin-docs:reference/configuration/global-vs-local.mdx";

/** Devin config files at the three documented levels (JSON with comments). */
export const CONFIG_LOCATIONS: SourceLocation[] = [
  { id: "config-user", kind: "config", scope: "global", base: "user-config", glob: "config.json", resolutionBasis: "documented", docRef: CONFIG_DOC },
  { id: "config-project", kind: "config", scope: "project", base: "project", glob: ".devin/config.json", resolutionBasis: "documented", docRef: CONFIG_DOC },
  { id: "config-project-local", kind: "config", scope: "project-local", base: "project", glob: ".devin/config.local.json", resolutionBasis: "documented", docRef: CONFIG_DOC },
];

/** Keys valid in any config file (documented). */
export const KNOWN_CONFIG_KEYS = [
  "permissions",
  "mcpServers", // legacy pre-v3000.3 location
  "read_config_from",
  "hooks",
  "agent",
  "theme_mode",
  "unicode_mode",
  "show_path",
  "show_hints",
  "include_gitignored_files",
  "sandbox",
  "subagents_enabled",
];

/** User-config-only keys per global-vs-local.mdx ("What's Available at Each Level"). */
export const USER_ONLY_KEYS = [
  "agent",
  "theme_mode",
  "unicode_mode",
  "show_path",
  "show_hints",
  "include_gitignored_files",
  "sandbox",
];

export { PRECEDENCE_DOC as CONFIG_PRECEDENCE_DOC };
