#!/usr/bin/env node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

// Canonical artifact URL shape; keep in sync with src/lib/paths.ts artifactPageUrl().
const url = process.argv[2] ?? "http://localhost:9999/artifacts/visualizer/agent-stack-report/"
const outDir = process.argv[3] ?? "ai-artifacts/visual-qa"
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const port = Number(process.env.VISUAL_QA_PORT ?? 9333)

await mkdir(outDir, { recursive: true })
const userDataDir = await mkdtemp(path.join(tmpdir(), "visual-qa-chrome-"))

const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "--hide-scrollbars",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] })

chrome.stderr.on("data", () => {})

try {
  const wsUrl = await waitForDebuggerUrl(port)
  const cdp = await connect(wsUrl)
  await cdp.send("Page.enable")
  await cdp.send("Runtime.enable")
  await cdp.send("DOM.enable")

  const shots = [
    { name: "light", width: 1440, height: 1200, colorScheme: "light", scale: 1 },
    { name: "dark", width: 1440, height: 1200, colorScheme: "dark", scale: 1 },
    { name: "mobile-light", width: 390, height: 1100, colorScheme: "light", scale: 2 },
  ]

  const results = []
  for (const shot of shots) {
    results.push(await capture(cdp, shot))
  }

  const metricsPath = path.join(outDir, "agent-stack-qa.json")
  await writeFile(metricsPath, `${JSON.stringify({ url, results }, null, 2)}\n`)
  console.log(JSON.stringify({ metricsPath, screenshots: results.map((result) => result.path) }, null, 2))

  await cdp.close()
} finally {
  chrome.kill("SIGTERM")
  await waitForExit(chrome)
  await rmWithRetry(userDataDir)
}

async function capture(cdp, shot) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: shot.width,
    height: shot.height,
    deviceScaleFactor: shot.scale,
    mobile: shot.width < 700,
  })
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: shot.colorScheme }],
  })
  await cdp.send("Page.navigate", { url })
  await waitForLoad(cdp)
  await cdp.send("Runtime.evaluate", { expression: "document.fonts && document.fonts.ready", awaitPromise: true })
  await waitForRuntime(cdp, "!document.body?.textContent.includes('Rendering Mermaid')", 15_000)
  await cdp.send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" })

  const metrics = await cdp.send("Page.getLayoutMetrics")
  const content = metrics.cssContentSize ?? metrics.contentSize
  const clipHeight = Math.min(content.height, shot.width < 700 ? 4200 : 3600)
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.min(content.width, shot.width), height: clipHeight, scale: 1 },
  })
  const filePath = path.join(outDir, `agent-stack-${shot.name}.png`)
  await writeFile(filePath, Buffer.from(screenshot.data, "base64"))

  const audit = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const root = document.scrollingElement || document.documentElement;
      const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const offenders = [...document.querySelectorAll('body *')]
        .filter((el) => isVisible(el) && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible')
        .slice(0, 12)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          className: String(el.className).slice(0, 140),
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100)
        }));
      const tables = [...document.querySelectorAll('[data-slot="table-container"]')].filter(isVisible).map((el) => ({
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        hasHorizontalScroll: el.scrollWidth > el.clientWidth + 2
      }));
      return {
        title: document.title,
        viewport: { width: innerWidth, height: innerHeight },
        page: { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, scrollHeight: root.scrollHeight },
        documentDark: document.documentElement.classList.contains('dark'),
        offenders,
        tables,
      };
    })()`,
  })

  return { name: shot.name, path: filePath, ...audit.result.value }
}

async function waitForDebuggerUrl(debugPort) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json())
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(120)
  }
  throw new Error("Timed out waiting for Chrome remote debugger")
}

async function waitForLoad(cdp) {
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 4_000)
    cdp.once("Page.loadEventFired", () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

async function waitForRuntime(cdp, expression, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true })
    if (result.result.value) return
    await sleep(150)
  }
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  const events = new Map()

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result ?? {})
      return
    }

    const callbacks = events.get(message.method)
    if (!callbacks) return
    for (const callback of callbacks.splice(0)) callback(message.params ?? {})
  })

  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve({
      send(method, params = {}) {
        const messageId = ++id
        ws.send(JSON.stringify({ id: messageId, method, params }))
        return new Promise((innerResolve, innerReject) => pending.set(messageId, { resolve: innerResolve, reject: innerReject }))
      },
      once(method, callback) {
        const callbacks = events.get(method) ?? []
        callbacks.push(callback)
        events.set(method, callbacks)
      },
      close() {
        ws.close()
      },
    }))
    ws.addEventListener("error", reject)
  })
}

async function waitForExit(child) {
  if (child.exitCode !== null) return

  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(2_000),
  ])

  if (child.exitCode === null) child.kill("SIGKILL")
}

async function rmWithRetry(target) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await rm(target, { recursive: true, force: true, maxRetries: 2, retryDelay: 150 })
      return
    } catch {
      if (attempt === 3) return
      await sleep(250)
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
