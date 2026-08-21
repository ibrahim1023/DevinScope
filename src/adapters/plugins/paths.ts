import type { SourceLocation } from "../types.js";

const PLUGINS_DOC = "devin-docs:extensibility/plugins/overview.mdx";

/**
 * Plugin sources per Devin CLI docs (plugins/overview.mdx):
 * - user-level installs cached under the CLI local-state dir
 *   (cache layout <host>_<repo>/<version>/, observed locally — the docs
 *   do not publish this layout; see design doc §2 note)
 * - repo-level requiredPlugins declared in .devin/config.json
 * Manifest precedence: .devin-plugin/plugin.json > .claude-plugin/plugin.json > plugin.json
 */
export const PLUGIN_LOCATIONS: SourceLocation[] = [
  { id: "plugin-cache", kind: "plugin", scope: "global", base: "local-state", glob: "cli/plugins/cache/*/*/", resolutionBasis: "undocumented", docRef: PLUGINS_DOC },
  { id: "plugin-required", kind: "plugin", scope: "project", base: "project", glob: ".devin/config.json", resolutionBasis: "documented", docRef: PLUGINS_DOC },
];
