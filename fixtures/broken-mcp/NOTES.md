# broken-mcp

Three documented MCP problems (devin-docs:extensibility/mcp/configuration.mdx):
malformed URL → MCP_BAD_URL MEDIUM; unset ${env:...} reference → MCP_MISSING_ENV
MEDIUM; nonexistent local command → MCP_CMD_MISSING HIGH. Env VALUES never leak.
