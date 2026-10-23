import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async ({ command }) => {
  if (command !== "serve") return { plugins: [react()] };
  // Development only. The production image builds without the port helper,
  // so the specifier is computed to keep the config bundler from resolving it.
  const ports = await import(new URL("./ports.mjs", import.meta.url).href);
  const host = "127.0.0.1";
  const record: Plugin = {
    name: "machina-port-record",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        if (!address || typeof address === "string") return;
        const remove = ports.register("web", host, address.port);
        server.httpServer?.once("close", remove);
        process.once("exit", remove);
      });
    },
  };
  // Follow the API to whichever port it is running on, per request. The
  // proxy copies these options for each request; `bypass` only sees a copy.
  let live: { target?: unknown } | undefined;
  // A config-change restart re-runs this file while the old server still
  // listens; keep that port instead of moving on.
  const held = ports.running("web").find((r: { pid: number }) => r.pid === process.pid);
  return {
    plugins: [react(), record],
    server: {
      host,
      port: held?.port ?? (await ports.findPort("web", { host })),
      strictPort: true,
      proxy: {
        "/api": {
          target: ports.serviceURL("api"),
          changeOrigin: false,
          configure(_proxy, options) {
            live = options;
          },
          bypass() {
            if (live) live.target = ports.serviceURL("api");
          },
        },
      },
    },
  };
});
