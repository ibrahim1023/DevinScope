import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/evals/**"],
        },
      },
      {
        test: {
          name: "evals",
          include: ["tests/evals/**/*.test.ts"],
          pool: "forks",
          maxWorkers: 1,
        },
      },
    ],
  },
});
