"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"

import {
  clampNumber,
  formatSvgViewBox,
  getMermaidScale,
  getSvgPoint,
  readSvgViewBox,
  viewBoxForScaleAtPoint,
  MERMAID_MAX_SCALE,
  MERMAID_MIN_SCALE,
  MERMAID_KEYBOARD_PAN,
  MERMAID_ZOOM_STEP,
  type MermaidViewBox,
} from "./mermaid-math"

export function useMermaidViewbox(svg: string) {
  const svgMountRef = useRef<HTMLDivElement>(null)
  const initialViewBoxRef = useRef<MermaidViewBox | null>(null)
  const viewBoxRef = useRef<MermaidViewBox | null>(null)
  const [initialViewBox, setInitialViewBox] = useState<MermaidViewBox | null>(null)
  const [viewBox, setViewBox] = useState<MermaidViewBox | null>(null)

  const getSvgElement = useCallback(
    () => svgMountRef.current?.querySelector("svg") as SVGSVGElement | null,
    []
  )

  const updateViewBox = useCallback(
    (nextViewBox: MermaidViewBox) => {
      viewBoxRef.current = nextViewBox
      getSvgElement()?.setAttribute("viewBox", formatSvgViewBox(nextViewBox))
      setViewBox(nextViewBox)
    },
    [getSvgElement]
  )

  useEffect(() => {
    const svgElement = getSvgElement()

    if (!svgElement) return

    let cancelled = false

    svgElement.setAttribute("width", "100%")
    svgElement.setAttribute("height", "100%")
    svgElement.style.display = "block"
    svgElement.style.maxWidth = "none"

    const nextViewBox = readSvgViewBox(svgElement)
    initialViewBoxRef.current = nextViewBox

    queueMicrotask(() => {
      if (cancelled) return

      setInitialViewBox(nextViewBox)
      updateViewBox(nextViewBox)
    })

    return () => {
      cancelled = true
    }
  }, [getSvgElement, svg, updateViewBox])

  useEffect(() => {
    const svgElement = getSvgElement()

    if (svgElement && viewBox) {
      svgElement.setAttribute("viewBox", formatSvgViewBox(viewBox))
    }
  }, [getSvgElement, viewBox])

  const zoomToScaleAt = useCallback(
    (clientX: number, clientY: number, targetScale: number) => {
      const initialViewBox = initialViewBoxRef.current
      const svgElement = getSvgElement()

      if (!initialViewBox || !svgElement) return

      const svgRect = svgElement.getBoundingClientRect()
      const scale = clampNumber(targetScale, MERMAID_MIN_SCALE, MERMAID_MAX_SCALE)
      const svgPoint = getSvgPoint(svgElement, clientX, clientY, viewBoxRef.current)

      updateViewBox(
        viewBoxForScaleAtPoint(initialViewBox, scale, svgPoint, clientX, clientY, svgRect)
      )
    },
    [getSvgElement, updateViewBox]
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const initialViewBox = initialViewBoxRef.current
      const currentViewBox = viewBoxRef.current
      const svgElement = getSvgElement()

      if (!initialViewBox || !currentViewBox || !svgElement) return

      const svgRect = svgElement.getBoundingClientRect()
      const currentScale = getMermaidScale(initialViewBox, currentViewBox)

      zoomToScaleAt(
        svgRect.left + svgRect.width / 2,
        svgRect.top + svgRect.height / 2,
        currentScale * factor
      )
    },
    [getSvgElement, zoomToScaleAt]
  )

  const resetView = useCallback(() => {
    const initialViewBox = initialViewBoxRef.current

    if (initialViewBox) updateViewBox(initialViewBox)
  }, [updateViewBox])

  const panByScreenPixels = useCallback(
    (deltaX: number, deltaY: number) => {
      const currentViewBox = viewBoxRef.current
      const svgElement = getSvgElement()

      if (!currentViewBox || !svgElement) return

      const svgRect = svgElement.getBoundingClientRect()
      updateViewBox({
        ...currentViewBox,
        x: currentViewBox.x + deltaX * (currentViewBox.width / svgRect.width),
        y: currentViewBox.y + deltaY * (currentViewBox.height / svgRect.height),
      })
    },
    [getSvgElement, updateViewBox]
  )

  const zoomScale = useMemo(
    () => (initialViewBox && viewBox ? getMermaidScale(initialViewBox, viewBox) : 1),
    [initialViewBox, viewBox]
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return

      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        zoomBy(MERMAID_ZOOM_STEP)
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault()
        zoomBy(1 / MERMAID_ZOOM_STEP)
      } else if (
        event.key === "0" ||
        event.key.toLowerCase() === "f" ||
        event.key.toLowerCase() === "r"
      ) {
        event.preventDefault()
        resetView()
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        panByScreenPixels(-MERMAID_KEYBOARD_PAN, 0)
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        panByScreenPixels(MERMAID_KEYBOARD_PAN, 0)
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        panByScreenPixels(0, -MERMAID_KEYBOARD_PAN)
      } else if (event.key === "ArrowDown") {
        event.preventDefault()
        panByScreenPixels(0, MERMAID_KEYBOARD_PAN)
      }
    },
    [panByScreenPixels, resetView, zoomBy]
  )

  return {
    svgMountRef,
    getSvgElement,
    initialViewBox,
    viewBox,
    initialViewBoxRef,
    viewBoxRef,
    updateViewBox,
    zoomToScaleAt,
    zoomBy,
    resetView,
    panByScreenPixels,
    zoomScale,
    handleKeyDown,
  }
}
