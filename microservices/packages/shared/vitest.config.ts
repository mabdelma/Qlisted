import { defineConfig } from "vitest/config";

// Present so vitest does not walk up to the repo-root config, which belongs to
// the frontend and pulls vitest from the root node_modules this workspace does
// not install. See .github/workflows/ci.yml (Microservices job).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
