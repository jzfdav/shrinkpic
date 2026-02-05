import preact from "@preact/preset-vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
  version?: string;
};

export default defineConfig({
  base: "/shrinkpic/",
  plugins: preact(),
  server: {
    host: true,
  },
  resolve: {
    alias: {
      "@ui": resolve(resolve(__dirname), "./src/components/ui/"),
      "@": resolve(resolve(__dirname), "./src/"),
    },
  },
  define: {
    "process.env.IS_PREACT": JSON.stringify("true"),
    __APP_VERSION__: JSON.stringify(pkg.version ?? "0.0.0"),
  },
});
