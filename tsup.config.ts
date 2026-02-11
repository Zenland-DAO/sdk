import { defineConfig } from "tsup";

export default defineConfig([
  // Core bundle (no React dependency)
  {
    entry: { index: "src/index.ts" },
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ["react", "@tanstack/react-query"],
  },
  // React bundle (requires React + React Query)
  {
    entry: { react: "src/react.ts" },
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    external: ["react", "@tanstack/react-query"],
    esbuildOptions(options) {
      options.banner = {
        js: '"use client";',
      };
    },
  },
]);
