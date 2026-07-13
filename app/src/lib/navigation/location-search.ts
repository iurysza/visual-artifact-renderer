"use client"

import { useSyncExternalStore } from "react"

const LOCATION_CHANGE_EVENT = "visualizer:location-change"

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback)
  window.addEventListener(LOCATION_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener(LOCATION_CHANGE_EVENT, callback)
  }
}

function getSnapshot() {
  return window.location.search
}

function getServerSnapshot() {
  return ""
}

export function useLocationSearch(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function replaceLocationSearch(search: string): void {
  const url = `${window.location.pathname}${search}${window.location.hash}`
  window.history.replaceState(window.history.state, "", url)
  window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT))
}
