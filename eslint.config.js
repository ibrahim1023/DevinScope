import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Layer direction per ADR-0001:
// cli → render → snapshots/diff → diagnostics → resolution → runtime → adapters/parsers → platform
// runtime, platform, security, parsers import nothing else in src/.
const layers = {
  top: ["src/cli/**"],
  render: ["src/render/**"],
  mid: ["src/snapshots/**", "src/diff/**", "src/diagnostics/**", "src/resolution/**"],
  leaf: ["src/adapters/**", "src/parsers/**", "src/security/**", "src/platform/**", "src/runtime/**"],
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/", "node_modules/", "coverage/", "fixtures/", ".superpowers/"],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  {
    // cli may not reach past the engine surface (platform allowed for log setup)
    files: layers.top,
    rules: {
      "no-restricted-imports": ["error", { patterns: ["**/adapters/**", "**/parsers/**"] }],
    },
  },
  {
    files: layers.render,
    rules: {
      "no-restricted-imports": ["error", { patterns: ["**/adapters/**", "**/parsers/**", "**/platform/**", "**/cli/**"] }],
    },
  },
  {
    files: layers.mid,
    rules: {
      "no-restricted-imports": ["error", { patterns: ["**/adapters/**", "**/render/**", "**/cli/**"] }],
    },
  },
  {
    // adapters may use parsers + platform + runtime + security; nothing above
    files: ["src/adapters/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["**/cli/**", "**/render/**", "**/snapshots/**", "**/diff/**", "**/diagnostics/**", "**/resolution/**"] },
      ],
    },
  },
  {
    // other leaves: no imports from any other src layer
    files: ["src/parsers/**", "src/security/**", "src/platform/**", "src/runtime/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "**/cli/**", "**/render/**", "**/snapshots/**", "**/diff/**",
            "**/diagnostics/**", "**/resolution/**", "**/adapters/**",
          ],
        },
      ],
    },
  },
);
