// JavaScript side of library/ports.py, for the Vite and Playwright configs.
// The same registry and rules: a requested port is used exactly; otherwise
// the first free port at or above the default, skipping other services'
// defaults. Running servers are recorded in .machina/servers/.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const registry = JSON.parse(
  fs.readFileSync(path.join(root, "library/ports.json"), "utf8"),
);
const loopback = { "": "127.0.0.1", "0.0.0.0": "127.0.0.1", "::": "::1" };

function service(name) {
  const entry = registry.services[name];
  if (!entry) throw new Error(`Unknown service ${name}; add it to library/ports.json`);
  return entry;
}

/** The exact port requested through the service's environment variables. */
export function requestedPort(name) {
  for (const variable of service(name).env) {
    const value = (process.env[variable] || "").trim();
    if (!value) continue;
    if (!/^\d+$/.test(value)) throw new Error(`${variable}=${value} is not a port number`);
    return Number(value);
  }
  return null;
}

export function candidates(name, exclude = []) {
  const start = service(name).port;
  const skip = new Set(exclude);
  for (const [other, entry] of Object.entries(registry.services))
    if (other !== name) skip.add(entry.port);
  const ports = [];
  for (let p = start; p < Math.min(start + registry.scan, 65536); p++)
    if (!skip.has(p)) ports.push(p);
  return ports;
}

function answers(host, port, timeout = 250) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: loopback[host] ?? host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

function bindable(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen({ host, port, exclusive: true }, () =>
      server.close(() => resolve(true)),
    );
  });
}

/**
 * The requested port for `name`, else the first free candidate. `exclude`
 * lists ports already promised to servers that have not started yet.
 */
export async function findPort(name, { host = "127.0.0.1", exclude = [] } = {}) {
  const exact = requestedPort(name);
  if (exact !== null) {
    if (exact && ((await answers(host, exact)) || !(await bindable(host, exact))))
      throw new Error(`${name}: requested port ${exact} on ${host} is already in use`);
    return exact;
  }
  const tried = candidates(name, exclude);
  for (const port of tried)
    if (!(await answers(host, port)) && (await bindable(host, port))) return port;
  throw new Error(
    `${name}: no free port in ${tried[0]}-${tried.at(-1)} on ${host}; ` +
      `set ${service(name).env[0]} to choose one`,
  );
}

export function url(host, port) {
  const shown = loopback[host] ?? host;
  return shown.includes(":") ? `http://[${shown}]:${port}` : `http://${shown}:${port}`;
}

const runtimeDir = () =>
  process.env.MACHINA_RUNTIME_DIR || path.join(root, ".machina/servers");

function alive(pid) {
  if (!(pid > 0)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** Running servers' records for `name`, newest first. */
export function running(name) {
  let files = [];
  try {
    files = fs.readdirSync(runtimeDir()).filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }
  const records = [];
  for (const file of files) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(runtimeDir(), file), "utf8"));
      if (record.service === name && alive(record.pid)) records.push(record);
    } catch {
      // A record being written or removed; skip it.
    }
  }
  return records.sort((a, b) => b.started - a.started);
}

/** The newest running server's URL, else the default address. */
export function serviceURL(name) {
  return running(name)[0]?.url ?? url("127.0.0.1", service(name).port);
}

/** Record a server started from Node (the Vite dev server); returns a remover. */
export function register(name, host, port) {
  const file = path.join(runtimeDir(), `${name}-${port}.json`);
  const record = { service: name, url: url(host, port), host, port, pid: process.pid, started: Date.now() / 1000 };
  try {
    fs.mkdirSync(runtimeDir(), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(record));
  } catch {
    return () => {};
  }
  return () => fs.rmSync(file, { force: true });
}
