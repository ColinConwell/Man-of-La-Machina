import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const at = (path) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: at("./"),
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  // Rive fetches its .riv URL; keep small rigs as same-origin files under CSP.
  build: { outDir: at("./dist"), emptyOutDir: true, assetsInlineLimit: 0 },
});
