import preact from "@preact/preset-vite";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@ui": resolve(resolve(__dirname), "./src/components/ui/"),
      "@": resolve(resolve(__dirname), "./src/"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
