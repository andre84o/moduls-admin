import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve the repo root, then expose forward-slash form for alias replacements.
const root = path.dirname(fileURLToPath(import.meta.url));
const rootPosix = root.replace(/\\/g, "/");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      // The "server-only" marker package throws outside a server-component
      // bundler; stub it so server modules can be imported under Node/vitest.
      {
        find: /^server-only$/,
        replacement: path.resolve(root, "tests/stubs/server-only.ts"),
      },
      // Mirror the tsconfig "@/*" -> "./*" path alias (regex so it never
      // swallows scoped packages like @base-ui/react).
      { find: /^@\//, replacement: `${rootPosix}/` },
    ],
  },
});
