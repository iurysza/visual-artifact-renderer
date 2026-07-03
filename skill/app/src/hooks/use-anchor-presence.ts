"use client"

import { useEffect, useState } from "react"

import { findAnchorElement, isAnchorOrphaned } from "@/components/annotation-helpers"

export function useAnchorPresence(nodeId: string | undefined, nodePath: string): boolean {
  const [present, setPresent] = useState(() => {
    if (typeof document === "undefined") return false
    return !isAnchorOrphaned(nodeId, nodePath)
  })

  useEffect(() => {
    const check = () => {
      setPresent(!isAnchorOrphaned(nodeId, nodePath))
    }

    check()

    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [nodeId, nodePath])

  return present
}

export function useAnchorElement(nodeId: string | undefined, nodePath: string): Element | null {
  const [element, setElement] = useState<Element | null>(() => {
    if (typeof document === "undefined") return null
    return findAnchorElement(nodeId, nodePath)
  })

  useEffect(() => {
    const check = () => {
      setElement(findAnchorElement(nodeId, nodePath))
    }

    check()

    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [nodeId, nodePath])

  return element
}
