"use client"

import { useEffect } from "react"

/**
 * Focus a textarea on coarse-pointer (mobile) devices when the supplied deps
 * change, and scroll it into view so the on-screen keyboard does not hide it.
 *
 * Mirrors the inline effect that used to live in both `CreateThreadComposer`
 * (annotation-panel) and `NodeCommentComposer` (ai-colab-panel). No-op on
 * desktop/pointer:fine so focus is not stolen.
 */
export function useMobileTextareaFocus(textareaId: string, deps: unknown[]): void {
  useEffect(() => {
    if (typeof window === "undefined") return
    const isMobile =
      window.matchMedia?.("(pointer:coarse)").matches || window.innerWidth <= 768
    if (!isMobile) return

    const id = window.setTimeout(() => {
      const el = document.getElementById(textareaId) as HTMLTextAreaElement | null
      if (!el) return
      try {
        el.focus()
      } catch {
        // ignore
      }
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      } catch {
        // ignore
      }
    }, 220)

    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}