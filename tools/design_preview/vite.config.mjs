import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const at = (path) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: at("./"),
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  build: { outDir: at("./dist"), emptyOutDir: true },
});
