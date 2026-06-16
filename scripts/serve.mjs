#!/usr/bin/env node
import { createServer } from "node:http";
import { stat, readdir, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PORT = parseInt(process.env.VISUALIZER_PORT ?? "9999", 10);
const HOST = process.env.VISUALIZER_HOST ?? "127.0.0.1";
const OUT_DIR = path.resolve(process.env.VISUALIZER_OUT_DIR ?? path.join(ROOT, "out"));
const ARTIFACTS_DIR = path.resolve((process.env.VISUALIZER_ARTIFACTS_DIR ?? "~/.pi/artifacts").replace(/^~/, os.homedir()));
const MOUNT_PATH = normalizeMountPath(process.env.VISUALIZER_MOUNT_PATH ?? "/artifacts");
const DATA_PATH = normalizeDataPath(process.env.VISUALIZER_DATA_PATH ?? "/data/artifacts");
const OPEN_BROWSER = (process.env.VISUALIZER_OPEN ?? "1") === "1";
const LIVE_ARTIFACT_SHELL = "/live-artifact";
const ROUTE_SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isLoopbackHost(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
};

function normalizeMountPath(value) {
  value = (value ?? "").trim();
  if (!value || value === "/") return "";
  if (!value.startsWith("/")) value = `/${value}`;
  return value.replace(/\/+$/, "");
}

function normalizeDataPath(value) {
  value = normalizeMountPath(value);
  if (!value) return "/data/artifacts";
  return value;
}

function stripMountPath(urlPath) {
  if (!MOUNT_PATH) return urlPath;
  if (urlPath === MOUNT_PATH || urlPath.startsWith(`${MOUNT_PATH}/`)) {
    return urlPath.slice(MOUNT_PATH.length) || "/";
  }
  // The app is mounted under a single base path everywhere (local, Tailscale,
  // blog). Requests outside that mount are 404; Tailscale should be configured
  // to proxy /artifacts/ to /artifacts/ on the backend so the prefix is preserved.
  return null;
}

async function readArtifactMeta(filePath) {
  let title = path.basename(filePath, ".json");
  let description;
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.title === "string" && parsed.title.length > 0) title = parsed.title;
    if (typeof parsed.description === "string" && parsed.description.length > 0) description = parsed.description;
  } catch {
    // ignore malformed JSON
  }
  return { title, description };
}

async function scanArtifacts() {
  const projects = [];
  const allArtifacts = [];

  try {
    const entries = await readdir(ARTIFACTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectDir = path.join(ARTIFACTS_DIR, entry.name);
      const files = await readdir(projectDir, { withFileTypes: true });
      const projectArtifacts = [];

      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".json")) continue;

        const slug = file.name.replace(/\.json$/, "");
        if (!ROUTE_SEGMENT_RE.test(slug)) continue;
        if (slug === entry.name) continue;

        const filePath = path.join(projectDir, file.name);
        const stats = await stat(filePath);
        const meta = await readArtifactMeta(filePath);

        const artifact = {
          slug,
          title: meta.title,
          description: meta.description,
          modifiedAt: stats.mtime.toISOString(),
        };
        projectArtifacts.push(artifact);
        allArtifacts.push({ ...artifact, project: entry.name });
      }

      if (projectArtifacts.length === 0) continue;

      projectArtifacts.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
      const lastModifiedAt = projectArtifacts[0].modifiedAt;

      projects.push({
        name: entry.name,
        artifactCount: projectArtifacts.length,
        lastModifiedAt,
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  projects.sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime());
  allArtifacts.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

  return { projects, artifacts: allArtifacts };
}

async function serveIndexJson(reqPath, res) {
  if (reqPath !== "/data/artifacts/index.json") return false;
  const { projects, artifacts } = await scanArtifacts();
  const recent = artifacts.slice(0, 12);
  const body = JSON.stringify({ projects, recent }, null, 2);
  send(res, 200, body, "application/json; charset=utf-8");
  return true;
}

async function serveProjectIndexJson(reqPath, res) {
  const prefix = "/data/artifacts/";
  if (!reqPath.startsWith(prefix) || !reqPath.endsWith("/index.json")) return false;
  const relative = reqPath.slice(prefix.length);
  const project = relative.replace(/\/index\.json$/, "");
  if (!ROUTE_SEGMENT_RE.test(project)) return false;

  const projectDir = path.resolve(ARTIFACTS_DIR, project);
  if (!projectDir.startsWith(ARTIFACTS_DIR + path.sep)) return false;

  const artifacts = [];
  try {
    const files = await readdir(projectDir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) continue;

      const slug = file.name.replace(/\.json$/, "");
      if (!ROUTE_SEGMENT_RE.test(slug)) continue;

      const filePath = path.join(projectDir, file.name);
      const stats = await stat(filePath);
      const meta = await readArtifactMeta(filePath);
      artifacts.push({
        slug,
        title: meta.title,
        description: meta.description,
        modifiedAt: stats.mtime.toISOString(),
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  artifacts.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  const body = JSON.stringify({ project, artifacts }, null, 2);
  send(res, 200, body, "application/json; charset=utf-8");
  return true;
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

async function fileExists(filePath) {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

async function dirExists(dirPath) {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

function send(res, status, body, contentType) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf-8");
  res.writeHead(status, {
    "Content-Type": contentType ?? "text/plain; charset=utf-8",
    "Content-Length": data.length,
  });
  res.end(data);
}

function streamFile(res, filePath) {
  res.writeHead(200, {
    "Content-Type": mimeType(filePath),
    "Cache-Control": "public, max-age=0, must-revalidate",
  });
  createReadStream(filePath).pipe(res);
}

function redirect(res, location) {
  const body = Buffer.from(`Redirecting to ${location}`, "utf-8");
  res.writeHead(302, {
    Location: location,
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
  });
  res.end(body);
}

async function serveArtifactJson(reqPath, res) {
  const prefix = `${DATA_PATH}/`;
  if (!reqPath.startsWith(prefix)) return false;
  const relative = reqPath.slice(prefix.length);
  const filePath = path.resolve(ARTIFACTS_DIR, relative);
  if (!filePath.startsWith(ARTIFACTS_DIR + path.sep)) {
    return false;
  }
  if (!(await fileExists(filePath))) return false;
  streamFile(res, filePath);
  return true;
}

async function serveStaticFile(reqPath, res) {
  const safePath = path.normalize(reqPath).replace(/^(\.\.(\/|$))+/, "");
  const filePath = path.join(OUT_DIR, safePath);
  if (!(await fileExists(filePath))) return false;
  streamFile(res, filePath);
  return true;
}

async function serveDirectoryIndex(reqPath, res) {
  const safePath = path.normalize(reqPath).replace(/^(\.\.(\/|$))+/, "");
  const dirPath = path.join(OUT_DIR, safePath);
  if (!(await dirExists(dirPath))) return false;
  const indexPath = path.join(dirPath, "index.html");
  if (!(await fileExists(indexPath))) return false;
  streamFile(res, indexPath);
  return true;
}

function artifactRouteFromPath(reqPath) {
  const segments = reqPath.split("/").filter(Boolean);
  if (segments.length !== 2) return null;

  const [project, slug] = segments;
  if (!ROUTE_SEGMENT_RE.test(project) || !ROUTE_SEGMENT_RE.test(slug)) return null;
  if (project === "data" || project === "_next" || project === LIVE_ARTIFACT_SHELL.slice(1)) return null;

  return { project, slug };
}

async function serveLiveArtifactShell(reqPath, res) {
  const route = artifactRouteFromPath(reqPath);
  if (!route) return false;

  const jsonPath = path.resolve(ARTIFACTS_DIR, route.project, `${route.slug}.json`);
  if (!jsonPath.startsWith(ARTIFACTS_DIR + path.sep)) return false;
  if (!(await fileExists(jsonPath))) return false;

  const shellPath = path.join(OUT_DIR, LIVE_ARTIFACT_SHELL, "index.html");
  if (!(await fileExists(shellPath))) return false;

  streamFile(res, shellPath);
  return true;
}

async function serveFallback(res) {
  const indexPath = path.join(OUT_DIR, "index.html");
  if (await fileExists(indexPath)) {
    streamFile(res, indexPath);
    return true;
  }
  return false;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // Redirect mount path without trailing slash to mount path with slash.
  if (MOUNT_PATH && pathname === MOUNT_PATH) {
    redirect(res, `${MOUNT_PATH}/`);
    return;
  }

  const stripped = stripMountPath(pathname);
  if (stripped === null) {
    send(res, 404, "Not found", "text/html; charset=utf-8");
    return;
  }

  // Artifact JSON lives outside the static export so updates apply without rebuilding.
  if (stripped.startsWith("/data/artifacts/")) {
    if (await serveIndexJson(stripped, res)) return;
    if (await serveProjectIndexJson(stripped, res)) return;
    if (await serveArtifactJson(stripped, res)) return;
    send(res, 404, "Artifact not found", "text/html; charset=utf-8");
    return;
  }

  // Static files first.
  if (await serveStaticFile(stripped, res)) return;

  // Directory indexes for trailing-slash routes.
  if (await serveDirectoryIndex(stripped, res)) return;

  // New artifacts may be created after the last static export. If the JSON
  // exists, serve a tiny client shell at the canonical URL and let it fetch
  // the latest artifact payload from the live JSON endpoint.
  if (await serveLiveArtifactShell(stripped, res)) return;

  // SPA fallback: let Next.js handle the route client-side.
  if (await serveFallback(res)) return;

  send(res, 404, "Not found", "text/html; charset=utf-8");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1);
  }
  throw err;
});

async function startupChecks() {
  if (!(await dirExists(OUT_DIR))) {
    console.error(`Static export directory missing: ${OUT_DIR}`);
    console.error("Run `pnpm build` first.");
    process.exit(1);
  }
  if (!(await dirExists(ARTIFACTS_DIR))) {
    console.warn(`Artifacts directory missing: ${ARTIFACTS_DIR}`);
  }
}

await startupChecks();

server.listen(PORT, HOST, async () => {
  const localUrl = `http://${HOST}:${PORT}${MOUNT_PATH}/`;
  console.log(`Visualizer server running at ${localUrl}`);
  console.log(`Serving static export: ${OUT_DIR}`);
  console.log(`Serving artifacts JSON: ${ARTIFACTS_DIR}`);
  console.log(`Artifact JSON endpoint: ${MOUNT_PATH}${DATA_PATH}/<project>/<slug>.json`);
  console.log(`Live index endpoint: ${MOUNT_PATH}${DATA_PATH}/index.json`);
  console.log(`Live project index endpoint: ${MOUNT_PATH}${DATA_PATH}/<project>/index.json`);
  console.log(`Live artifact fallback: ${MOUNT_PATH}/<project>/<slug>/ -> ${LIVE_ARTIFACT_SHELL}/`);

  const tailscaleIp = await getTailscaleIp();
  if (tailscaleIp) {
    if (isLoopbackHost(HOST)) {
      console.log(
        `Direct tailnet IP access is disabled while VISUALIZER_HOST=${HOST}. Set VISUALIZER_HOST=0.0.0.0 to open http://${tailscaleIp}:${PORT}${MOUNT_PATH}/ directly on your tailnet.`,
      );
    } else {
      console.log(`Direct tailnet URL: http://${tailscaleIp}:${PORT}${MOUNT_PATH}/`);
    }
  }

  if (OPEN_BROWSER && HOST === "127.0.0.1") {
    openBrowser(localUrl);
  }
});

async function getTailscaleIp() {
  try {
    const { execSync } = await import("node:child_process");
    const output = execSync("tailscale ip -4", { encoding: "utf-8", timeout: 5000 });
    return output.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

function openBrowser(url) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(command, [url], { detached: true, stdio: "ignore" });
  child.unref();
}
