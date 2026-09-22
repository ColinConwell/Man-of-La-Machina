import { defineConfig } from "../../apps/web/node_modules/vite/dist/node/index.js";
import react from "../../apps/web/node_modules/@vitejs/plugin-react/dist/index.js";
import { fileURLToPath } from "node:url";
const at = (path) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: at("./web"),
  plugins: [react()],
  resolve: {
    alias: {
      "react-dom": at("../../apps/web/node_modules/react-dom"),
      "react-markdown": at("../../apps/web/node_modules/react-markdown"),
      react: at("../../apps/web/node_modules/react"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: { outDir: at("./dist"), emptyOutDir: true },
});
