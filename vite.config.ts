import preact from "@preact/preset-vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/shrinkpic/",
  plugins: [preact()],
  server: {
    host: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
  resolve: {
    alias: {
      "@ui": resolve(resolve(__dirname), "./src/components/ui/"),
      "@": resolve(resolve(__dirname), "./src/"),
    },
  },
  define: {
    "process.env.IS_PREACT": JSON.stringify("true"),
  },
});
