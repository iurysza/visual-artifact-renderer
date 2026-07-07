"use client"

import { useEffect, type ReactNode } from "react"

const SCROLL_IDLE_MS = 700
const SCROLLING_CLASS = "is-scrolling"
const SCROLL_AREA_SELECTOR = "[data-slot='scroll-area']"

export function ScrollActiveProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const timers = new Map<Element, number>()

    const markScrolling = (element: Element) => {
      element.classList.add(SCROLLING_CLASS)

      const previousTimer = timers.get(element)
      if (previousTimer) window.clearTimeout(previousTimer)

      const timer = window.setTimeout(() => {
        element.classList.remove(SCROLLING_CLASS)
        timers.delete(element)
      }, SCROLL_IDLE_MS)

      timers.set(element, timer)
    }

    const getScrollElement = (target: EventTarget | null) => {
      if (
        target === window ||
        target === document ||
        target === document.documentElement ||
        target === document.body
      ) {
        return document.documentElement
      }

      return target instanceof Element ? target : null
    }

    const onScroll = (event: Event) => {
      const element = getScrollElement(event.target)
      if (!element) return

      markScrolling(element)

      const scrollArea = element.closest(SCROLL_AREA_SELECTOR)
      if (scrollArea) markScrolling(scrollArea)
    }

    document.addEventListener("scroll", onScroll, { capture: true, passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      document.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("scroll", onScroll)
      timers.forEach((timer, element) => {
        window.clearTimeout(timer)
        element.classList.remove(SCROLLING_CLASS)
      })
      timers.clear()
    }
  }, [])

  return children
}
