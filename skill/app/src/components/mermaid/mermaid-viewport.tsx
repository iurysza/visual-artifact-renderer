"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Maximize2Icon, Minimize2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  clampNumber,
  getMermaidScale,
  getPointerCenter,
  getPointerDistance,
  getSvgPoint,
  viewBoxForScaleAtPoint,
  MERMAID_MAX_SCALE,
  MERMAID_MIN_SCALE,
  MERMAID_ZOOM_STEP,
  type PointerPosition,
} from "./mermaid-math"
import { useMermaidViewbox } from "./use-mermaid-viewbox"

type MermaidDragState = {
  pointerId: number
  lastClientX: number
  lastClientY: number
}

type MermaidPinchState = {
  startDistance: number
  startScale: number
  centerSvgPoint: { x: number; y: number }
}

export function MermaidViewport({
  svg,
  height,
  instructionsId,
  onToggleMaximize,
  isMaximized = false,
}: {
  svg: string
  height: number | string
  instructionsId: string
  onToggleMaximize?: () => void
  isMaximized?: boolean
}) {
  const {
    svgMountRef,
    initialViewBoxRef,
    viewBoxRef,
    updateViewBox,
    zoomToScaleAt,
    zoomBy,
    resetView,
    panByScreenPixels,
    zoomScale,
    handleKeyDown,
  } = useMermaidViewbox(svg)

  const viewportRef = useRef<HTMLDivElement>(null)
  const pointersRef = useRef(new Map<number, PointerPosition>())
  const dragRef = useRef<MermaidDragState | null>(null)
  const pinchRef = useRef<MermaidPinchState | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const getSvgElement = useCallback(
    () => svgMountRef.current?.querySelector("svg") as SVGSVGElement | null,
    [svgMountRef]
  )

  const startPinch = useCallback(() => {
    const pointerEntries = Array.from(pointersRef.current.values())
    const initialViewBox = initialViewBoxRef.current
    const currentViewBox = viewBoxRef.current
    const svgElement = getSvgElement()

    if (
      pointerEntries.length < 2 ||
      !initialViewBox ||
      !currentViewBox ||
      !svgElement
    )
      return

    const [firstPointer, secondPointer] = pointerEntries
    const center = getPointerCenter(firstPointer, secondPointer)
    const startDistance = getPointerDistance(firstPointer, secondPointer)

    if (startDistance <= 0) return

    pinchRef.current = {
      startDistance,
      startScale: getMermaidScale(initialViewBox, currentViewBox),
      centerSvgPoint: getSvgPoint(svgElement, center.clientX, center.clientY, currentViewBox),
    }
    dragRef.current = null
    setIsDragging(true)
  }, [getSvgElement, initialViewBoxRef, viewBoxRef])

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const initialViewBox = initialViewBoxRef.current
      const currentViewBox = viewBoxRef.current

      if (!initialViewBox || !currentViewBox) return
      if (!event.metaKey && !event.ctrlKey) return

      event.preventDefault()

      const currentScale = getMermaidScale(initialViewBox, currentViewBox)
      const sensitivity = event.ctrlKey && !event.metaKey ? 0.006 : 0.002
      const nextScale = currentScale * Math.exp(-event.deltaY * sensitivity)

      zoomToScaleAt(event.clientX, event.clientY, nextScale)
    },
    [initialViewBoxRef, viewBoxRef, zoomToScaleAt]
  )

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) return

    viewport.addEventListener("wheel", handleWheel, { passive: false })

    return () => viewport.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const currentViewBox = viewBoxRef.current

      if (!currentViewBox || (event.pointerType === "mouse" && event.button !== 0))
        return

      event.currentTarget.setPointerCapture(event.pointerId)
      pointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      })

      if (pointersRef.current.size >= 2) {
        startPinch()
        return
      }

      dragRef.current = {
        pointerId: event.pointerId,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
      }
      setIsDragging(true)
    },
    [startPinch, viewBoxRef]
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(event.pointerId)) return

      pointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      })

      if (pointersRef.current.size >= 2 && pinchRef.current) {
        const initialViewBox = initialViewBoxRef.current
        const svgElement = getSvgElement()
        const [firstPointer, secondPointer] = Array.from(pointersRef.current.values())

        if (!initialViewBox || !svgElement || !firstPointer || !secondPointer) return

        event.preventDefault()

        const currentDistance = getPointerDistance(firstPointer, secondPointer)
        const center = getPointerCenter(firstPointer, secondPointer)
        const targetScale =
          pinchRef.current.startScale * (currentDistance / pinchRef.current.startDistance)

        updateViewBox(
          viewBoxForScaleAtPoint(
            initialViewBox,
            clampNumber(targetScale, MERMAID_MIN_SCALE, MERMAID_MAX_SCALE),
            pinchRef.current.centerSvgPoint,
            center.clientX,
            center.clientY,
            svgElement.getBoundingClientRect()
          )
        )
        return
      }

      const dragState = dragRef.current

      if (!dragState || dragState.pointerId !== event.pointerId) return

      event.preventDefault()

      const deltaX = event.clientX - dragState.lastClientX
      const deltaY = event.clientY - dragState.lastClientY

      dragRef.current = {
        pointerId: event.pointerId,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
      }

      panByScreenPixels(-deltaX, -deltaY)
    },
    [getSvgElement, initialViewBoxRef, panByScreenPixels, updateViewBox]
  )

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      pointersRef.current.delete(event.pointerId)
      pinchRef.current = null

      if (pointersRef.current.size >= 2) {
        startPinch()
        return
      }

      if (pointersRef.current.size === 1 && viewBoxRef.current) {
        const [remainingPointerId, remainingPointer] = Array.from(
          pointersRef.current.entries()
        )[0]
        dragRef.current = {
          pointerId: remainingPointerId,
          lastClientX: remainingPointer.clientX,
          lastClientY: remainingPointer.clientY,
        }
        setIsDragging(true)
        return
      }

      dragRef.current = null
      setIsDragging(false)
    },
    [startPinch, viewBoxRef]
  )

  const svgMarkup = useMemo(() => ({ __html: svg }), [svg])
  const fillsParent = height === "100%"

  return (
    <div className={cn("flex flex-col gap-3", fillsParent && "h-full min-h-0")}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/60 px-3 py-2">
        <p id={instructionsId} className="text-xs leading-5 text-muted-foreground">
          ⌘/Ctrl + wheel or pinch to zoom. Drag to pan. Focus the diagram for arrows, +/−, and
          0/F reset.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{Math.round(zoomScale * 100)}%</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Zoom out Mermaid diagram"
            onClick={() => zoomBy(1 / MERMAID_ZOOM_STEP)}
          >
            −
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Zoom in Mermaid diagram"
            onClick={() => zoomBy(MERMAID_ZOOM_STEP)}
          >
            +
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={resetView}>
            Fit
          </Button>
          {onToggleMaximize && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={
                isMaximized ? "Minimize Mermaid diagram" : "Maximize Mermaid diagram"
              }
              onClick={onToggleMaximize}
            >
              {isMaximized ? (
                <Minimize2Icon className="h-4 w-4" />
              ) : (
                <Maximize2Icon className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      <div
        ref={viewportRef}
        aria-describedby={instructionsId}
        aria-label={isMaximized ? "Maximized Mermaid diagram" : "Zoomable Mermaid diagram"}
        className={cn(
          "overflow-hidden rounded-xl border bg-background/60 p-2 outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50",
          fillsParent && "min-h-0 flex-1",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        role="region"
        style={{ height: fillsParent ? undefined : height, touchAction: "none" }}
        tabIndex={0}
      >
        <div
          ref={svgMountRef}
          className="h-full w-full select-none [&_svg]:h-full [&_svg]:w-full [&_svg]:max-w-none"
          dangerouslySetInnerHTML={svgMarkup}
        />
      </div>
    </div>
  )
}
