import type { SourceLocation } from "../types.js";

const MCP_DOC = "devin-docs:extensibility/mcp/configuration.mdx";
const PRECEDENCE_DOC = "devin-docs:reference/configuration/global-vs-local.mdx";

/**
 * MCP config locations per Devin CLI docs. Since v3000.3 servers live in
 * dedicated mcp_config.json files; the legacy `mcpServers` key in
 * config.json is still discovered (INFO diagnostic). Precedence is
 * documented: project-local > project > user, merged by name.
 */
export const MCP_LOCATIONS: SourceLocation[] = [
  { id: "mcp-user", kind: "mcp", scope: "global", base: "user-config", glob: "mcp_config.json", resolutionBasis: "documented", docRef: MCP_DOC },
  { id: "mcp-project", kind: "mcp", scope: "project", base: "project", glob: ".devin/mcp_config.json", resolutionBasis: "documented", docRef: MCP_DOC },
  { id: "mcp-project-local", kind: "mcp", scope: "project-local", base: "project", glob: ".devin/mcp_config.local.json", resolutionBasis: "documented", docRef: MCP_DOC },
];

/** Legacy pre-v3000.3 locations: mcpServers key inside config.json. */
export const MCP_LEGACY_LOCATIONS: SourceLocation[] = [
  { id: "mcp-legacy-user", kind: "mcp", scope: "global", base: "user-config", glob: "config.json", resolutionBasis: "documented", docRef: MCP_DOC },
  { id: "mcp-legacy-project", kind: "mcp", scope: "project", base: "project", glob: ".devin/config.json", resolutionBasis: "documented", docRef: MCP_DOC },
  { id: "mcp-legacy-project-local", kind: "mcp", scope: "project-local", base: "project", glob: ".devin/config.local.json", resolutionBasis: "documented", docRef: MCP_DOC },
];

export { PRECEDENCE_DOC };
