"use client"

import { useCallback, useSyncExternalStore } from "react"

export const PANEL_VALUES = ["comments", "colab"] as const
export type PanelValue = (typeof PANEL_VALUES)[number]

export type PanelParams = {
  panel: PanelValue | null
  thread: string | null
  node: string | null
  pick: "1" | null
}

const NULL_PARAMS: PanelParams = { panel: null, thread: null, node: null, pick: null }
const subscribers = new Set<() => void>()

function emit() {
  for (const cb of subscribers) cb()
}

function subscribe(cb: () => void) {
  subscribers.add(cb)
  if (typeof window !== "undefined") window.addEventListener("popstate", cb)
  return () => {
    subscribers.delete(cb)
    if (typeof window !== "undefined") window.removeEventListener("popstate", cb)
  }
}

function readParams(): PanelParams {
  if (typeof window === "undefined") return NULL_PARAMS
  const sp = new URLSearchParams(window.location.search)
  const panel = sp.get("panel")
  return {
    panel: panel === "comments" || panel === "colab" ? panel : null,
    thread: sp.get("thread"),
    node: sp.get("node"),
    pick: sp.get("pick") === "1" ? "1" : null,
  }
}

let cached: PanelParams = NULL_PARAMS
let cachedSearch = ""
function getSnapshot(): PanelParams {
  if (typeof window === "undefined") return NULL_PARAMS
  const search = window.location.search
  if (search === cachedSearch) return cached
  cachedSearch = search
  cached = readParams()
  return cached
}

function getServerSnapshot(): PanelParams {
  return NULL_PARAMS
}

function serialize(p: PanelParams): string {
  const sp = new URLSearchParams()
  if (p.panel) sp.set("panel", p.panel)
  if (p.thread) sp.set("thread", p.thread)
  if (p.node) sp.set("node", p.node)
  if (p.pick) sp.set("pick", "1")
  const str = sp.toString()
  return str ? `?${str}` : ""
}

export type SetPanelParams = (
  values: Partial<PanelParams>,
  options?: { history: "push" | "replace" },
) => void

export function usePanelParams(): readonly [PanelParams, SetPanelParams] {
  const params = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setParams = useCallback<SetPanelParams>((values, options = { history: "replace" }) => {
    if (typeof window === "undefined") return
    const prev = readParams()
    const next = { ...prev, ...values }
    const url = `${window.location.pathname}${serialize(next)}${window.location.hash}`
    if (options.history === "replace") window.history.replaceState(null, "", url)
    else window.history.pushState(null, "", url)
    emit()
  }, [])

  return [params, setParams] as const
}
