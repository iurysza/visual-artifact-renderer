#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

const url = process.argv[2] ?? "http://localhost:9999/visualizer/artifacts/visualizer/audioguide-runtime-architecture/"
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const port = Number(process.env.MERMAID_DEBUG_PORT ?? 9334)
const userDataDir = await mkdtemp(path.join(tmpdir(), "mermaid-debug-chrome-"))

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
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await cdp.send("Page.navigate", { url })
  await waitForLoad(cdp)
  await cdp.send("Runtime.evaluate", { expression: "document.fonts && document.fonts.ready", awaitPromise: true })
  await waitForRuntime(cdp, "!document.body?.textContent.includes('Rendering Mermaid') && document.querySelector('[aria-label=\\\"Zoomable Mermaid diagram\\\"] svg')", 15_000)

  const initial = await snapshot(cdp)
  await cdp.send("Runtime.evaluate", { expression: `(() => {
    const region = document.querySelector('[aria-label="Zoomable Mermaid diagram"]');
    const rect = region.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top - 160, left: 0, behavior: 'instant' });
  })()` })
  await sleep(300)
  const positioned = await snapshot(cdp)

  let center = {
    x: Math.round(positioned.rect.left + positioned.rect.width / 2),
    y: Math.round(positioned.rect.top + positioned.rect.height / 2),
  }

  const beforePlainWheel = await snapshot(cdp)
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: center.x,
    y: center.y,
    deltaX: 0,
    deltaY: 240,
  })
  await sleep(250)
  const afterPlainWheel = await snapshot(cdp)

  await cdp.send("Runtime.evaluate", { expression: `(() => {
    const region = document.querySelector('[aria-label="Zoomable Mermaid diagram"]');
    const rect = region.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top - 160, left: 0, behavior: 'instant' });
  })()` })
  await sleep(100)
  const repositionedAfterPlainWheel = await snapshot(cdp)
  center = {
    x: Math.round(repositionedAfterPlainWheel.rect.left + repositionedAfterPlainWheel.rect.width / 2),
    y: Math.round(repositionedAfterPlainWheel.rect.top + repositionedAfterPlainWheel.rect.height / 2),
  }

  await cdp.send("Runtime.evaluate", { expression: `(() => {
    window.__wheelTrace = [];
    const region = document.querySelector('[aria-label="Zoomable Mermaid diagram"]');
    const record = (phase, event) => window.__wheelTrace.push({
      phase,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      deltaY: event.deltaY,
      cancelable: event.cancelable,
      defaultPrevented: event.defaultPrevented,
      target: event.target?.tagName,
      scrollY: window.scrollY,
      viewBox: region.querySelector('svg')?.getAttribute('viewBox'),
    });
    region.addEventListener('wheel', (event) => record('region-capture', event), { capture: true, passive: false });
    document.addEventListener('wheel', (event) => record('document-bubble', event), { passive: false });
  })()` })

  // Real-ish browser wheel event over the SVG. Ctrl modifier matches component's zoom path.
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: center.x,
    y: center.y,
    deltaX: 0,
    deltaY: -320,
    modifiers: 2,
  })
  await sleep(250)
  const afterCtrlWheel = await snapshot(cdp)
  const wheelTrace = await cdp.send("Runtime.evaluate", { expression: "window.__wheelTrace", returnByValue: true })

  // Use the component's own + button to establish zoom without involving wheel/default scrolling.
  await cdp.send("Runtime.evaluate", { expression: "document.querySelector('[aria-label=\\\"Zoom in Mermaid diagram\\\"]').click()" })
  await sleep(100)
  const beforeDrag = await snapshot(cdp)
  await cdp.send("Runtime.evaluate", { expression: `(() => {
    window.__dragTrace = [];
    const region = document.querySelector('[aria-label="Zoomable Mermaid diagram"]');
    const mount = region.querySelector('.h-full.w-full') || region;
    const currentSvg = () => region.querySelector('svg');
    const record = (phase, event) => window.__dragTrace.push({
      phase,
      type: event?.type,
      pointerId: event?.pointerId,
      pointerType: event?.pointerType,
      button: event?.button,
      buttons: event?.buttons,
      cancelable: event?.cancelable,
      defaultPrevented: event?.defaultPrevented,
      clientX: event?.clientX,
      clientY: event?.clientY,
      scrollY: window.scrollY,
      viewBox: currentSvg()?.getAttribute('viewBox'),
      sameSvg: currentSvg() === window.__dragSvg,
    });
    window.__dragSvg = currentSvg();
    const mo = new MutationObserver((records) => {
      for (const entry of records) {
        window.__dragTrace.push({
          phase: 'mutation',
          type: entry.type,
          attributeName: entry.attributeName,
          scrollY: window.scrollY,
          viewBox: currentSvg()?.getAttribute('viewBox'),
          sameSvg: currentSvg() === window.__dragSvg,
        });
      }
    });
    mo.observe(window.__dragSvg, { attributes: true, attributeFilter: ['viewBox'] });
    mo.observe(mount, { childList: true, subtree: true });
    window.__dragObserver = mo;
    region.addEventListener('pointerdown', (event) => record('region-capture', event), { capture: true, passive: false });
    region.addEventListener('pointermove', (event) => record('region-capture', event), { capture: true, passive: false });
    region.addEventListener('pointerup', (event) => record('region-capture', event), { capture: true, passive: false });
    document.addEventListener('pointerdown', (event) => record('document-bubble', event), { passive: false });
    document.addEventListener('pointermove', (event) => record('document-bubble', event), { passive: false });
    document.addEventListener('pointerup', (event) => record('document-bubble', event), { passive: false });
  })()` })
  const dragCenter = {
    x: Math.round(beforeDrag.rect.left + beforeDrag.rect.width / 2),
    y: Math.round(beforeDrag.rect.top + beforeDrag.rect.height / 2),
  }

  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: dragCenter.x, y: dragCenter.y, button: "left", buttons: 1, clickCount: 1 })
  await sleep(50)
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: dragCenter.x + 120, y: dragCenter.y + 40, button: "left", buttons: 1 })
  await sleep(50)
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: dragCenter.x + 180, y: dragCenter.y + 60, button: "left", buttons: 1 })
  await sleep(50)
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: dragCenter.x + 180, y: dragCenter.y + 60, button: "left", buttons: 0, clickCount: 1 })
  await sleep(250)
  const afterDrag = await snapshot(cdp)
  const dragTrace = await cdp.send("Runtime.evaluate", { expression: "window.__dragObserver?.disconnect(); window.__dragTrace", returnByValue: true })

  const syntheticWheel = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const region = document.querySelector('[aria-label="Zoomable Mermaid diagram"]');
      const svg = region?.querySelector('svg');
      const rect = region.getBoundingClientRect();
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaY: -120,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      });
      svg.dispatchEvent(event);
      return { defaultPrevented: event.defaultPrevented, viewBox: svg.getAttribute('viewBox') };
    })()`,
  })

  console.log(JSON.stringify({
    url,
    initial,
    positioned,
    center,
    beforePlainWheel,
    afterPlainWheel,
    repositionedAfterPlainWheel,
    afterCtrlWheel,
    wheelTrace: wheelTrace.result.value,
    beforeDrag,
    afterDrag,
    dragTrace: dragTrace.result.value,
    syntheticWheel: syntheticWheel.result.value,
  }, null, 2))

  await cdp.close()
} finally {
  chrome.kill("SIGTERM")
  await waitForExit(chrome)
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 2, retryDelay: 150 }).catch(() => {})
}

async function snapshot(cdp) {
  const result = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const root = document.scrollingElement || document.documentElement;
      const region = document.querySelector('[aria-label="Zoomable Mermaid diagram"]');
      const svg = region?.querySelector('svg');
      const rect = region?.getBoundingClientRect();
      const viewBox = svg?.getAttribute('viewBox') ?? null;
      const values = viewBox ? viewBox.split(/[\\s,]+/).map(Number) : [];
      const initial = window.__initialMermaidViewBox ??= viewBox;
      const initialWidth = Number(initial?.split(/[\\s,]+/)[2] || values[2] || 0);
      return {
        scrollY: window.scrollY,
        scrollTop: root.scrollTop,
        pageScale: window.visualViewport?.scale ?? 1,
        viewBox,
        scale: values[2] ? initialWidth / values[2] : null,
        rect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
      };
    })()`,
  })
  return result.result.value
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
  throw new Error(`Timed out waiting for ${expression}`)
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
