#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

const url = process.argv[2] ?? "http://localhost:9999/artifacts/visualizer/mermaid-repro/"
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const port = Number(process.env.MERMAID_DEBUG_PORT ?? 9335)
const userDataDir = await mkdtemp(path.join(tmpdir(), "mermaid-cold-load-"))

const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
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
  await cdp.send("Network.enable")
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await cdp.send("Page.navigate", { url })
  await waitForLoad(cdp)

  const deadline = Date.now() + 15_000
  let lastState = null

  while (Date.now() < deadline) {
    const state = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => ({
        renderingCount: Array.from(document.querySelectorAll('p')).filter(p => p.textContent.includes('Rendering Mermaid')).length,
        svgCount: document.querySelectorAll('svg').length,
        sample: document.body.innerText.slice(0, 300)
      }))()`,
    })
    lastState = state.result.value
    if (lastState.renderingCount === 0 && lastState.svgCount >= 3) {
      break
    }
    await sleep(200)
  }

  console.log(JSON.stringify({ url, finalState: lastState, timedOut: lastState.renderingCount > 0 }, null, 2))

  await cdp.close()
} finally {
  chrome.kill("SIGTERM")
  await waitForExit(chrome)
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 2, retryDelay: 150 }).catch(() => {})
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
      resolve(undefined)
    })
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
