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

export function serializePanelParams(search: string, params: PanelParams): string {
  const sp = new URLSearchParams(search)
  for (const key of ["panel", "thread", "node", "pick"]) sp.delete(key)
  if (params.panel) sp.set("panel", params.panel)
  if (params.thread) sp.set("thread", params.thread)
  if (params.node) sp.set("node", params.node)
  if (params.pick) sp.set("pick", "1")
  const value = sp.toString()
  return value ? `?${value}` : ""
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
    const search = serializePanelParams(window.location.search, next)
    const url = `${window.location.pathname}${search}${window.location.hash}`
    if (options.history === "replace") window.history.replaceState(null, "", url)
    else window.history.pushState(null, "", url)
    emit()
  }, [])

  return [params, setParams] as const
}
