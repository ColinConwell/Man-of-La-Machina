import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const at = (path) => fileURLToPath(new URL(path, import.meta.url));
const fontDir = at("./web/assets/fonts/");
const fontManifest = JSON.parse(readFileSync(`${fontDir}/manifest.json`, "utf8"));
const fontCredits = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Landscape Studio Font Credits</title><body><main><h1>Font Credits &amp; Licenses</h1><p>These typefaces are distributed unmodified under the SIL Open Font License 1.1. The preview serves them locally.</p><ul>${fontManifest.fonts.map(font => `<li>${font.family} — ${font.designer}. <a href="${font.license.file}">Full License</a></li>`).join("")}</ul><p><a href="manifest.json">Sources, versions, and checksums</a></p></main></body></html>`;
export default defineConfig({
  root: at("./"),
  plugins: [react(), {
    name: "local-font-licenses",
    generateBundle() {
      for (const file of ["manifest.json", ...fontManifest.fonts.map(font => font.license.file)]) {
        this.emitFile({ type: "asset", fileName: `font-licenses/${file}`, source: readFileSync(`${fontDir}/${file}`) });
      }
      this.emitFile({ type: "asset", fileName: "font-licenses/index.html", source: fontCredits });
    },
    configureServer(server) {
      server.middlewares.use("/font-licenses", (request, response, next) => {
        const name = request.url.split("?")[0].replace(/^\//, "");
        if (!["index.html", "manifest.json", ...fontManifest.fonts.map(font => font.license.file)].includes(name)) return next();
        response.setHeader("Content-Type", name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".json") ? "application/json" : "text/plain; charset=utf-8");
        response.end(name === "index.html" ? fontCredits : readFileSync(`${fontDir}/${name}`));
      });
    },
  }],
  resolve: { dedupe: ["react", "react-dom"] },
  // Rive fetches its .riv URL; keep small rigs as same-origin files under CSP.
  build: { outDir: at("./dist"), emptyOutDir: true, assetsInlineLimit: 0 },
});
