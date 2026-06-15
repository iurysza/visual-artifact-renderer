# Mermaid graph zoom/drag bug report

## Thesis

Two separate bugs share one symptom cluster:

1. Wheel zoom is handled through React `onWheel`, but React 19 registers `wheel` as passive. `event.preventDefault()` is ignored, so the diagram zooms and the page scrolls.
2. Drag resets zoom because `dangerouslySetInnerHTML={{ __html: svg }}` creates a new prop object every render. Drag state updates cause React to replace the SVG DOM node with the original Mermaid markup, wiping the mutated `viewBox`.

No app code changed. Debug artifacts only:

- `ai-artifacts/mermaid-graph-debug/cdp-repro.mjs`
- `ai-artifacts/mermaid-graph-debug/cdp-repro-output.json`

## Repro target

URL used while `next dev -p 9999` was already running:

```txt
http://localhost:9999/visualizer/artifacts/visualizer/audioguide-runtime-architecture/
```

Relevant component:

```txt
src/components/component-registry.tsx
```

Relevant entities:

- `ZoomableMermaidViewport` lines 382-729
- `handleWheel` lines 517-533
- pointer drag path lines 536-628
- viewport JSX `onWheel={handleWheel}` line 716
- SVG mount `dangerouslySetInnerHTML={{ __html: svg }}` line 724

## Evidence

Command:

```bash
node ai-artifacts/mermaid-graph-debug/cdp-repro.mjs > ai-artifacts/mermaid-graph-debug/cdp-repro-output.json
```

Observed output summary:

```json
{
  "positioned": { "scrollY": 950, "viewBox": "-50 -10 1968 929", "scale": 1 },
  "afterCtrlWheel": { "scrollY": 630, "viewBox": "737.2 362.286 393.6 185.8", "scale": 5 },
  "beforeDrag": { "viewBox": "737.2 362.286 393.6 185.8", "scale": 5 },
  "afterDrag": { "viewBox": "-50 -10 1968 929", "scale": 1 }
}
```

Meaning:

- Ctrl-wheel over the diagram zoomed to `scale: 5`.
- The page also scrolled from `scrollY: 950` to `630`.
- Drag started at `scale: 5` and ended at `scale: 1`.

Wheel trace:

```json
{
  "phase": "document-bubble",
  "ctrlKey": true,
  "cancelable": true,
  "defaultPrevented": false,
  "target": "svg"
}
```

`defaultPrevented` stays `false` even though `handleWheel` calls `event.preventDefault()`.

React source confirms why:

```txt
node_modules/react-dom/cjs/react-dom-client.development.js:19254
"wheel" !== domEventName) || (listenerWrapper = !0)
```

and then registers:

```txt
passive: listenerWrapper
```

So React's delegated `wheel` listener is passive.

Drag trace also shows the SVG node being replaced during drag:

```json
{
  "phase": "mutation",
  "type": "childList",
  "viewBox": "-50 -10 1968 929",
  "sameSvg": false
}
```

This happens immediately after `pointerdown` and again around pointer moves/up. The final `pointerup` re-render resets the inner SVG to Mermaid's original markup and no later `viewBox` state change restores the zoom.

## Root causes

### 1. Wheel scroll conflict

Current code:

```tsx
const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
  if (!initialViewBox || !currentViewBox) return
  if (!event.metaKey && !event.ctrlKey) return

  event.preventDefault()
  // zoom...
}, [zoomToScaleAt])
```

Problem: React's `onWheel` is passive. `preventDefault()` is a no-op for native scrolling.

### 2. Drag reset

Current code:

```tsx
<div
  ref={svgMountRef}
  className="h-full w-full select-none [&_svg]:h-full [&_svg]:w-full [&_svg]:max-w-none"
  dangerouslySetInnerHTML={{ __html: svg }}
/>
```

Every render creates a new `{ __html: svg }` object. During drag, these state updates re-render the component:

- `setIsDragging(true)` on pointerdown
- `setViewBox(nextViewBox)` on pointermove
- `setIsDragging(false)` on pointerup

React rewrites `innerHTML`, replacing the SVG DOM node. Since zoom/pan are stored by mutating the rendered SVG `viewBox`, the replacement resets the diagram to the original Mermaid `viewBox`.

## Recommended fix

Minimal patch path:

1. Memoize the dangerous HTML object so React does not rewrite the SVG on unrelated renders.

```tsx
const svgMarkup = useMemo(() => ({ __html: svg }), [svg])

<div
  ref={svgMountRef}
  className="h-full w-full select-none [&_svg]:h-full [&_svg]:w-full [&_svg]:max-w-none"
  dangerouslySetInnerHTML={svgMarkup}
/>
```

2. Replace React `onWheel` with a native non-passive listener on the viewport element.

Sketch:

```tsx
const viewportRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const viewport = viewportRef.current
  if (!viewport) return

  const handleNativeWheel = (event: WheelEvent) => {
    const initialViewBox = initialViewBoxRef.current
    const currentViewBox = viewBoxRef.current

    if (!initialViewBox || !currentViewBox) return
    if (!event.metaKey && !event.ctrlKey) return

    event.preventDefault()

    const currentScale = getMermaidScale(initialViewBox, currentViewBox)
    const sensitivity = event.ctrlKey && !event.metaKey ? 0.006 : 0.002
    const nextScale = currentScale * Math.exp(-event.deltaY * sensitivity)

    zoomToScaleAt(event.clientX, event.clientY, nextScale)
  }

  viewport.addEventListener("wheel", handleNativeWheel, { passive: false })
  return () => viewport.removeEventListener("wheel", handleNativeWheel)
}, [zoomToScaleAt])
```

Then:

- add `ref={viewportRef}` to the outer zoom region
- remove `onWheel={handleWheel}`
- remove the unused `ReactWheelEvent` import

3. For smoother drag, update the SVG attribute synchronously in `updateViewBox`.

```tsx
const updateViewBox = useCallback((nextViewBox: MermaidViewBox) => {
  viewBoxRef.current = nextViewBox
  getSvgElement()?.setAttribute("viewBox", formatSvgViewBox(nextViewBox))
  setViewBox(nextViewBox)
}, [getSvgElement])
```

This avoids waiting for React effects on every pointer move. Keep state for the zoom badge/buttons, but let the DOM mutation be the immediate source of visual feedback.

Optional follow-up: throttle `setViewBox` with `requestAnimationFrame` during drag/pinch if pointermove still feels heavy.

## UX note

Current copy says:

```txt
⌘/Ctrl + wheel or pinch to zoom. Drag to pan.
```

The minimal fix preserves that behavior.

If the intended UX is plain mouse-wheel zoom while hovering the diagram, remove the modifier guard and update the copy to `Wheel or pinch to zoom`. That is a product choice; do not mix it into the bug fix unless requested.

## Acceptance checks for fixing agent

Run:

```bash
node ai-artifacts/mermaid-graph-debug/cdp-repro.mjs > ai-artifacts/mermaid-graph-debug/cdp-repro-output.json
```

Expected after fix:

- Ctrl-wheel changes `viewBox` scale but leaves page scroll unchanged.
- Wheel trace has `defaultPrevented: true` by document bubble phase.
- Drag preserves scale: `afterDrag.scale === beforeDrag.scale`.
- Drag trace no longer shows SVG replacement caused by unrelated drag renders, or replacement no longer resets final `viewBox`.

Also manually check:

- `+`, `−`, `Fit`, keyboard arrows, and `0/F/R` still work.
- Pinch still works on touch devices/emulation.
- Drag after zoom pans without jumping.
