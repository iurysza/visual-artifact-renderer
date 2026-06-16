"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"

import type { ArtifactColumn, ArtifactFlowItem, ArtifactNode, ArtifactTone, VisualArtifactSpec } from "@/lib/artifact-schema"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Prose } from "@/components/ui/prose"
import { CodeBlock } from "@/components/ui/code-block"
import { DefinitionList } from "@/components/ui/definition-list"
import { Diff } from "@/components/ui/diff"
import { FileTree } from "@/components/ui/file-tree"
import { ArtifactImage } from "@/components/ui/artifact-image"
import { PieChart as PieChartComponent } from "@/components/ui/pie-chart"
import { Stepper } from "@/components/ui/stepper"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Maximize2Icon, Minimize2Icon } from "lucide-react"

import { SvgDiagram } from "@/components/svg-diagram"

type ArtifactRenderContext = {
  data: VisualArtifactSpec["data"]
}

type RenderNodes = (nodes: ArtifactNode[] | undefined, context: ArtifactRenderContext) => ReactNode

type AdapterArgs<T extends ArtifactNode["type"]> = {
  node: Extract<ArtifactNode, { type: T }>
  children?: ReactNode
  context: ArtifactRenderContext
  renderNodes: RenderNodes
}

type RegistryAdapter = (args: {
  node: ArtifactNode
  children?: ReactNode
  context: ArtifactRenderContext
  renderNodes: RenderNodes
}) => ReactNode

export const componentRegistry = {
  alert: renderAlert as RegistryAdapter,
  "definition-list": renderDefinitionList as RegistryAdapter,
  diff: renderDiff as RegistryAdapter,
  "donut-chart": renderDonutChart as RegistryAdapter,
  "file-tree": renderFileTree as RegistryAdapter,
  image: renderImage as RegistryAdapter,
  "pie-chart": renderPieChart as RegistryAdapter,
  stepper: renderStepper as RegistryAdapter,
  heading: renderHeading as RegistryAdapter,
  prose: renderProse as RegistryAdapter,
  text: renderText as RegistryAdapter,
  card: renderCard as RegistryAdapter,
  metric: renderMetric as RegistryAdapter,
  "stat-card": renderStatCard as RegistryAdapter,
  badge: renderBadge as RegistryAdapter,
  button: renderButton as RegistryAdapter,
  separator: renderSeparator as RegistryAdapter,
  table: renderTable as RegistryAdapter,
  "data-table": renderDataTable as RegistryAdapter,
  "comparison-table": renderComparisonTable as RegistryAdapter,
  chart: renderChart as RegistryAdapter,
  mermaid: renderMermaid as RegistryAdapter,
  "svg-diagram": renderSvgDiagram as RegistryAdapter,
  flow: renderFlow as RegistryAdapter,
  timeline: renderTimeline as RegistryAdapter,
  "code-block": renderCodeBlock as RegistryAdapter,
  "status-grid": renderStatusGrid as RegistryAdapter,
  grid: renderGrid as RegistryAdapter,
  section: renderSection as RegistryAdapter,
  tabs: renderTabs as RegistryAdapter,
  accordion: renderAccordion as RegistryAdapter,
} satisfies Record<ArtifactNode["type"], RegistryAdapter>

export type { ArtifactRenderContext, RenderNodes }

function renderAlert({ node }: AdapterArgs<"alert">) {
  const { title, description, variant } = node.props
  return (
    <Alert variant={variant}>
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
    </Alert>
  )
}

function renderDefinitionList({ node }: AdapterArgs<"definition-list">) {
  const { items } = node.props
  return <DefinitionList items={items} />
}

function renderDiff({ node }: AdapterArgs<"diff">) {
  const { before, after, language } = node.props
  return <Diff before={before} after={after} language={language} />
}

function renderFileTree({ node }: AdapterArgs<"file-tree">) {
  const { items } = node.props
  return <FileTree items={items} />
}

function renderImage({ node }: AdapterArgs<"image">) {
  const { src, alt, caption, aspect } = node.props
  return <ArtifactImage src={src} alt={alt} caption={caption} aspect={aspect} />
}

function renderPieChart({ node, context }: AdapterArgs<"pie-chart">) {
  const { dataKey, categoryKey, valueKey } = node.props
  const data = getRows(context.data, dataKey)
  if (!data.length) return <MissingData dataKey={dataKey} />
  return <PieChartComponent data={data as Record<string, unknown>[]} categoryKey={categoryKey} valueKey={valueKey} kind="pie" />
}

function renderDonutChart({ node, context }: AdapterArgs<"donut-chart">) {
  const { dataKey, categoryKey, valueKey } = node.props
  const data = getRows(context.data, dataKey)
  if (!data.length) return <MissingData dataKey={dataKey} />
  return <PieChartComponent data={data as Record<string, unknown>[]} categoryKey={categoryKey} valueKey={valueKey} kind="donut" />
}

function renderStepper({ node }: AdapterArgs<"stepper">) {
  const { items } = node.props
  return <Stepper items={items} />
}

function renderHeading({ node }: AdapterArgs<"heading">) {
  const { text, level = 2, align = "left" } = node.props
  const className = cn(
    "font-serif font-medium tracking-[-0.025em] text-foreground",
    level === 1 && "text-4xl leading-tight sm:text-5xl",
    level === 2 && "text-3xl leading-tight",
    level === 3 && "text-2xl leading-snug",
    level === 4 && "text-xl leading-snug",
    align === "center" && "text-center",
    align === "right" && "text-right"
  )

  if (level === 1) return <h1 className={className}>{text}</h1>
  if (level === 3) return <h3 className={className}>{text}</h3>
  if (level === 4) return <h4 className={className}>{text}</h4>

  return <h2 className={className}>{text}</h2>
}

function renderText({ node }: AdapterArgs<"text">) {
  const { text, tone = "default", size = "base", align = "left" } = node.props

  return (
    <p
      className={cn(
        "max-w-4xl leading-7",
        tone === "muted" && "text-muted-foreground",
        size === "sm" && "text-sm leading-6",
        size === "lg" && "text-lg leading-8",
        align === "center" && "mx-auto text-center",
        align === "right" && "ml-auto text-right"
      )}
    >
      {text}
    </p>
  )
}

function renderProse({ node }: AdapterArgs<"prose">) {
  return <Prose>{node.props.content}</Prose>
}

function renderCard({ node, children }: AdapterArgs<"card">) {
  const props = node.props ?? {}

  return (
    <Card size={props.size} className={tonePanelClass(props.tone)}>
      {(props.title || props.description) && (
        <CardHeader>
          {props.title && <CardTitle>{props.title}</CardTitle>}
          {props.description && <CardDescription>{props.description}</CardDescription>}
        </CardHeader>
      )}
      {children && <CardContent className="flex flex-col gap-4">{children}</CardContent>}
    </Card>
  )
}

function renderMetric({ node }: AdapterArgs<"metric">) {
  const { label, value, delta, trend = "neutral" } = node.props

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-end gap-2">
        <p className="min-w-0 max-w-full break-words font-serif text-4xl font-medium leading-none tracking-[-0.035em] text-foreground">{value}</p>
        {delta && <TrendPill trend={trend}>{delta}</TrendPill>}
      </div>
    </div>
  )
}

function renderStatCard({ node }: AdapterArgs<"stat-card">) {
  const { label, value, delta, trend = "neutral", caption, tone = "default" } = node.props

  return (
    <div className={cn("min-h-full rounded-2xl border-[1.5px] bg-card/95 p-5 text-card-foreground shadow-[0_10px_34px_rgba(20,20,19,0.06)] dark:shadow-black/20", tonePanelClass(tone))}>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <p className="min-w-0 max-w-full break-words font-serif text-4xl font-medium leading-none tracking-[-0.04em] text-foreground">{value}</p>
        {delta && <TrendPill trend={trend}>{delta}</TrendPill>}
      </div>
      {caption && <p className="mt-3 text-sm leading-6 text-muted-foreground">{caption}</p>}
    </div>
  )
}

function renderBadge({ node }: AdapterArgs<"badge">) {
  return <Badge variant={node.props.variant}>{node.props.label}</Badge>
}

function renderButton({ node }: AdapterArgs<"button">) {
  const { label, href, variant, size } = node.props

  if (href) {
    return (
      <a className={buttonVariants({ variant, size })} href={href}>
        {label}
      </a>
    )
  }

  return (
    <Button variant={variant} size={size}>
      {label}
    </Button>
  )
}

function renderSeparator() {
  return <Separator />
}

function renderTable({ node, context }: AdapterArgs<"table">) {
  return <TableBlock data={getRows(context.data, node.props.dataKey)} {...node.props} />
}

function renderDataTable({ node, context }: AdapterArgs<"data-table">) {
  return <TableBlock dense data={getRows(context.data, node.props.dataKey)} {...node.props} />
}

function renderComparisonTable({ node, context }: AdapterArgs<"comparison-table">) {
  return <TableBlock comparison dense data={getRows(context.data, node.props.dataKey)} {...node.props} />
}

function renderChart({ node, context }: AdapterArgs<"chart">) {
  const { dataKey, xKey, yKey, kind = "line", label = yKey, color = "var(--chart-2)" } = node.props
  const data = getRows(context.data, dataKey)
  const config = {
    [yKey]: { label, color },
  } satisfies ChartConfig

  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <div className="rounded-xl border bg-background/40 p-3">
      <ChartContainer config={config} className="min-h-[300px] w-full">
        {kind === "bar" ? (
          <BarChart accessibilityLayer data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={10} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey={yKey} fill={color} radius={[8, 8, 0, 0]} barSize={42} isAnimationActive={false} />
          </BarChart>
        ) : (
          <LineChart accessibilityLayer data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={10} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} width={44} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey={yKey} type="monotone" stroke={color} strokeWidth={3} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        )}
      </ChartContainer>
    </div>
  )
}

function renderMermaid({ node }: AdapterArgs<"mermaid">) {
  return <MermaidDiagram {...node.props} />
}

function renderSvgDiagram({ node }: AdapterArgs<"svg-diagram">) {
  return <SvgDiagram {...node.props} />
}

let mermaidRenderQueue: Promise<unknown> = Promise.resolve()

function runWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Mermaid render timed out after ${ms}ms`))
    }, ms)

    fn().then(
      (result) => {
        clearTimeout(timeoutId)
        resolve(result)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
}

function enqueueMermaidRender<T>(renderFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      try {
        const result = await runWithTimeout(renderFn, 10000)
        resolve(result)
        return result
      } catch (error) {
        reject(error)
        return undefined
      }
    }

    mermaidRenderQueue = mermaidRenderQueue.then(run, run)
  })
}

const MERMAID_MIN_SCALE = 0.5
const MERMAID_MAX_SCALE = 5
const MERMAID_ZOOM_STEP = 1.2
const MERMAID_KEYBOARD_PAN = 48

type MermaidViewBox = {
  x: number
  y: number
  width: number
  height: number
}

type PointerPosition = {
  clientX: number
  clientY: number
}

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

function MermaidDiagram({
  code,
  title,
  caption,
  height = 420,
}: {
  code: string
  title?: string
  caption?: string
  height?: number
}) {
  const rawId = useId()
  const diagramId = useMemo(() => `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [rawId])
  const [theme, setTheme] = useState<"default" | "dark">("default")
  const [svg, setSvg] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const syncTheme = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "default")

    syncTheme()

    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      try {
        setError(null)
        setSvg("")

        const rendered = await enqueueMermaidRender(async () => {
          const { default: mermaid } = await import("mermaid")

          mermaid.initialize({
            startOnLoad: false,
            theme,
            securityLevel: "strict",
            fontFamily: "var(--font-geist-sans)",
          })

          return mermaid.render(`${diagramId}-${theme}`, code)
        })

        if (!cancelled) {
          setSvg(rendered.svg)
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Could not render Mermaid diagram")
        }
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [code, diagramId, theme])

  return (
    <figure className="flex flex-col gap-3 rounded-2xl border bg-card/80 p-4 shadow-sm">
      {(title || caption) && (
        <figcaption className="flex flex-col gap-1">
          {title && <h3 className="font-serif text-2xl font-medium tracking-[-0.02em] text-foreground">{title}</h3>}
          {caption && <p className="text-sm leading-6 text-muted-foreground">{caption}</p>}
        </figcaption>
      )}
      {error ? (
        <pre className="whitespace-pre-wrap rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</pre>
      ) : svg ? (
        <ZoomableMermaidViewport height={height} instructionsId={`${diagramId}-instructions`} svg={svg} />
      ) : (
        <div className="rounded-xl border bg-background/60 p-4" style={{ minHeight: height }}>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Rendering Mermaid…</p>
        </div>
      )}
    </figure>
  )
}

function ZoomableMermaidViewport({ svg, height, instructionsId }: { svg: string; height: number; instructionsId: string }) {
  const [isMaximized, setIsMaximized] = useState(false)

  return (
    <>
      <MermaidViewport
        svg={svg}
        height={height}
        instructionsId={instructionsId}
        onToggleMaximize={() => setIsMaximized(true)}
      />
      <Dialog open={isMaximized} onOpenChange={setIsMaximized}>
        <DialogContent
          className="gap-0 overflow-hidden rounded-2xl p-0"
          style={{
            width: "min(calc(100vw - 1rem), 80rem)",
            maxWidth: "calc(100vw - 1rem)",
            height: "80dvh",
            maxHeight: "calc(100dvh - 1rem)",
          }}
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Maximized Mermaid diagram</DialogTitle>
          </DialogHeader>
          <div className="flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4">
            <MermaidViewport
              svg={svg}
              height="100%"
              instructionsId={`${instructionsId}-maximized`}
              isMaximized
              onToggleMaximize={() => setIsMaximized(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MermaidViewport({
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
  const viewportRef = useRef<HTMLDivElement>(null)
  const svgMountRef = useRef<HTMLDivElement>(null)
  const initialViewBoxRef = useRef<MermaidViewBox | null>(null)
  const viewBoxRef = useRef<MermaidViewBox | null>(null)
  const pointersRef = useRef(new Map<number, PointerPosition>())
  const dragRef = useRef<MermaidDragState | null>(null)
  const pinchRef = useRef<MermaidPinchState | null>(null)
  const [initialViewBox, setInitialViewBox] = useState<MermaidViewBox | null>(null)
  const [viewBox, setViewBox] = useState<MermaidViewBox | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const getSvgElement = useCallback(() => svgMountRef.current?.querySelector("svg") as SVGSVGElement | null, [])

  const updateViewBox = useCallback(
    (nextViewBox: MermaidViewBox) => {
      viewBoxRef.current = nextViewBox
      getSvgElement()?.setAttribute("viewBox", formatSvgViewBox(nextViewBox))
      setViewBox(nextViewBox)
    },
    [getSvgElement]
  )

  const zoomToScaleAt = useCallback(
    (clientX: number, clientY: number, targetScale: number) => {
      const initialViewBox = initialViewBoxRef.current
      const svgElement = getSvgElement()

      if (!initialViewBox || !svgElement) return

      const svgRect = svgElement.getBoundingClientRect()
      const scale = clampNumber(targetScale, MERMAID_MIN_SCALE, MERMAID_MAX_SCALE)
      const svgPoint = getSvgPoint(svgElement, clientX, clientY, viewBoxRef.current)

      updateViewBox(viewBoxForScaleAtPoint(initialViewBox, scale, svgPoint, clientX, clientY, svgRect))
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

      zoomToScaleAt(svgRect.left + svgRect.width / 2, svgRect.top + svgRect.height / 2, currentScale * factor)
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

  const startPinch = useCallback(() => {
    const pointerEntries = Array.from(pointersRef.current.values())
    const initialViewBox = initialViewBoxRef.current
    const currentViewBox = viewBoxRef.current
    const svgElement = getSvgElement()

    if (pointerEntries.length < 2 || !initialViewBox || !currentViewBox || !svgElement) return

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
  }, [getSvgElement])

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
    pointersRef.current.clear()
    dragRef.current = null
    pinchRef.current = null

    queueMicrotask(() => {
      if (cancelled) return

      setInitialViewBox(nextViewBox)
      updateViewBox(nextViewBox)
      setIsDragging(false)
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
    [zoomToScaleAt]
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

      if (!currentViewBox || (event.pointerType === "mouse" && event.button !== 0)) return

      event.currentTarget.setPointerCapture(event.pointerId)
      pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })

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
    [startPinch]
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(event.pointerId)) return

      pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })

      if (pointersRef.current.size >= 2 && pinchRef.current) {
        const initialViewBox = initialViewBoxRef.current
        const svgElement = getSvgElement()
        const [firstPointer, secondPointer] = Array.from(pointersRef.current.values())

        if (!initialViewBox || !svgElement || !firstPointer || !secondPointer) return

        event.preventDefault()

        const currentDistance = getPointerDistance(firstPointer, secondPointer)
        const center = getPointerCenter(firstPointer, secondPointer)
        const targetScale = pinchRef.current.startScale * (currentDistance / pinchRef.current.startDistance)

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
      const svgElement = getSvgElement()

      if (!dragState || dragState.pointerId !== event.pointerId || !svgElement) return

      event.preventDefault()

      const currentViewBox = viewBoxRef.current

      if (!currentViewBox) return

      const svgRect = svgElement.getBoundingClientRect()
      const deltaX = event.clientX - dragState.lastClientX
      const deltaY = event.clientY - dragState.lastClientY

      dragRef.current = {
        pointerId: event.pointerId,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
      }

      updateViewBox({
        ...currentViewBox,
        x: currentViewBox.x - deltaX * (currentViewBox.width / svgRect.width),
        y: currentViewBox.y - deltaY * (currentViewBox.height / svgRect.height),
      })
    },
    [getSvgElement, updateViewBox]
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
        const [remainingPointerId, remainingPointer] = Array.from(pointersRef.current.entries())[0]
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
    [startPinch]
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
      } else if (event.key === "0" || event.key.toLowerCase() === "f" || event.key.toLowerCase() === "r") {
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

  const zoomScale = initialViewBox && viewBox ? getMermaidScale(initialViewBox, viewBox) : 1
  const svgMarkup = useMemo(() => ({ __html: svg }), [svg])
  const fillsParent = height === "100%"

  return (
    <div className={cn("flex flex-col gap-3", fillsParent && "h-full min-h-0")}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/60 px-3 py-2">
        <p id={instructionsId} className="text-xs leading-5 text-muted-foreground">
          ⌘/Ctrl + wheel or pinch to zoom. Drag to pan. Focus the diagram for arrows, +/−, and 0/F reset.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{Math.round(zoomScale * 100)}%</Badge>
          <Button type="button" variant="outline" size="sm" aria-label="Zoom out Mermaid diagram" onClick={() => zoomBy(1 / MERMAID_ZOOM_STEP)}>
            −
          </Button>
          <Button type="button" variant="outline" size="sm" aria-label="Zoom in Mermaid diagram" onClick={() => zoomBy(MERMAID_ZOOM_STEP)}>
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
              aria-label={isMaximized ? "Minimize Mermaid diagram" : "Maximize Mermaid diagram"}
              onClick={onToggleMaximize}
            >
              {isMaximized ? <Minimize2Icon className="h-4 w-4" /> : <Maximize2Icon className="h-4 w-4" />}
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

function readSvgViewBox(svgElement: SVGSVGElement): MermaidViewBox {
  const viewBox = svgElement.getAttribute("viewBox")
  const values = viewBox?.split(/[\s,]+/).map(Number).filter(Number.isFinite)

  if (values?.length === 4 && values[2] > 0 && values[3] > 0) {
    return { x: values[0], y: values[1], width: values[2], height: values[3] }
  }

  try {
    const box = svgElement.getBBox()

    if (box.width > 0 && box.height > 0) {
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
  } catch {}

  return { x: 0, y: 0, width: 100, height: 100 }
}

function formatSvgViewBox(viewBox: MermaidViewBox) {
  return [viewBox.x, viewBox.y, viewBox.width, viewBox.height].map((value) => Number(value.toFixed(3))).join(" ")
}

function getMermaidScale(initialViewBox: MermaidViewBox, currentViewBox: MermaidViewBox) {
  return initialViewBox.width / currentViewBox.width
}

function getSvgPoint(svgElement: SVGSVGElement, clientX: number, clientY: number, fallbackViewBox: MermaidViewBox | null) {
  const matrix = svgElement.getScreenCTM()

  if (matrix) {
    const point = svgElement.createSVGPoint()
    point.x = clientX
    point.y = clientY

    return point.matrixTransform(matrix.inverse())
  }

  const svgRect = svgElement.getBoundingClientRect()
  const viewBox = fallbackViewBox ?? readSvgViewBox(svgElement)
  const relativeX = clampNumber((clientX - svgRect.left) / svgRect.width, 0, 1)
  const relativeY = clampNumber((clientY - svgRect.top) / svgRect.height, 0, 1)

  return {
    x: viewBox.x + viewBox.width * relativeX,
    y: viewBox.y + viewBox.height * relativeY,
  }
}

function viewBoxForScaleAtPoint(
  initialViewBox: MermaidViewBox,
  targetScale: number,
  svgPoint: { x: number; y: number },
  clientX: number,
  clientY: number,
  svgRect: DOMRect
): MermaidViewBox {
  const width = initialViewBox.width / targetScale
  const height = initialViewBox.height / targetScale
  const relativeX = clampNumber((clientX - svgRect.left) / svgRect.width, 0, 1)
  const relativeY = clampNumber((clientY - svgRect.top) / svgRect.height, 0, 1)

  return {
    x: svgPoint.x - width * relativeX,
    y: svgPoint.y - height * relativeY,
    width,
    height,
  }
}

function getPointerDistance(firstPointer: PointerPosition, secondPointer: PointerPosition) {
  return Math.hypot(firstPointer.clientX - secondPointer.clientX, firstPointer.clientY - secondPointer.clientY)
}

function getPointerCenter(firstPointer: PointerPosition, secondPointer: PointerPosition) {
  return {
    clientX: (firstPointer.clientX + secondPointer.clientX) / 2,
    clientY: (firstPointer.clientY + secondPointer.clientY) / 2,
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function renderFlow({ node }: AdapterArgs<"flow">) {
  const { title, caption, items } = node.props

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card/80 p-4 shadow-sm">
      {(title || caption) && (
        <div className="flex flex-col gap-1">
          {title && <h3 className="font-serif text-2xl font-medium tracking-[-0.02em] text-foreground">{title}</h3>}
          {caption && <p className="text-sm leading-6 text-muted-foreground">{caption}</p>}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-[repeat(var(--flow-columns),minmax(0,1fr))]" style={{ "--flow-columns": items.length } as CSSProperties}>
        {items.map((item, index) => (
          <FlowStep key={`${item.title}-${index}`} item={item} index={index} />
        ))}
      </div>
    </div>
  )
}

function FlowStep({ item, index }: { item: ArtifactFlowItem; index: number }) {
  const statusStr = item.status !== undefined ? formatCell(item.status) : ""
  const descStr = item.description !== undefined ? formatCell(item.description) : ""
  
  const showStatus = item.status !== undefined && 
                     statusStr.length > 0 && 
                     statusStr.length <= 16 && 
                     statusStr.toLowerCase() !== descStr.toLowerCase()

  return (
    <div className="relative">
      <div className={cn("min-h-full rounded-xl border bg-background/70 p-4", item.status && statusPanelClass(item.status))}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card font-mono text-xs font-medium text-muted-foreground">
            {index + 1}
          </span>
          {showStatus && <StatusChip value={item.status} className="max-w-[50%] justify-start" />}
        </div>
        {item.label && <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--clay)]">{item.label}</p>}
        <p className="mt-1 truncate font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">{item.title}</p>
        {item.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}
      </div>
    </div>
  )
}

function renderTimeline({ node, context }: AdapterArgs<"timeline">) {
  const { dataKey, titleKey = "title", markerKey = "marker", descriptionKey = "description", statusKey = "status", caption } = node.props
  const data = getRows(context.data, dataKey)

  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card/80 p-4 shadow-sm">
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      <div className="relative flex flex-col gap-4 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-border">
        {data.map((row, index) => {
          const statusVal = row[statusKey]
          const descStr = row[descriptionKey] !== undefined ? formatCell(row[descriptionKey]) : ""
          const statusStr = statusVal !== undefined ? formatCell(statusVal) : ""
          
          const showStatus = statusVal !== undefined && 
                             statusStr.length > 0 && 
                             statusStr.length <= 16 && 
                             statusStr.toLowerCase() !== descStr.toLowerCase()

          return (
            <article key={index} className="relative grid grid-cols-[2rem_1fr] gap-3">
              <div className="relative z-10 flex size-8 items-center justify-center rounded-full border bg-card font-mono text-[10px] font-medium text-muted-foreground">
                {formatCell(row[markerKey] ?? index + 1)}
              </div>
              <div className={cn("rounded-xl border bg-background/70 p-4", statusPanelClass(row[statusKey]))}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="truncate font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">{formatCell(row[titleKey])}</p>
                  {showStatus && <StatusChip value={row[statusKey]} className="max-w-[50%] justify-start" />}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{formatCell(row[descriptionKey])}</p>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function renderCodeBlock({ node }: AdapterArgs<"code-block">) {
  return <CodeBlock {...node.props} />
}

function renderStatusGrid({ node, context }: AdapterArgs<"status-grid">) {
  const { dataKey, titleKey = "title", statusKey, descriptionKey, metaKey, columns = 3, caption } = node.props
  const data = getRows(context.data, dataKey)

  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  return (
    <div className="flex flex-col gap-3">
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      <div className={cn("grid gap-5", columnsClass(columns))}>
        {data.map((row, index) => {
          const title = row[titleKey] ?? row.component ?? row.name ?? `Item ${index + 1}`
          const description = descriptionKey ? row[descriptionKey] : row.notes ?? row.description
          const meta = metaKey ? row[metaKey] : undefined
          
          const statusVal = row[statusKey]
          const descStr = description !== undefined ? formatCell(description) : ""
          const statusStr = statusVal !== undefined ? formatCell(statusVal) : ""
          
          // Only show top-right status badge if it's short and not redundant with the description
          const showStatus = statusVal !== undefined && 
                             statusStr.length > 0 && 
                             statusStr.length <= 16 && 
                             statusStr.toLowerCase() !== descStr.toLowerCase()

          return (
            <div key={index} className={cn("min-h-full rounded-2xl border-[1.5px] bg-card/95 p-4 text-card-foreground shadow-[0_10px_34px_rgba(20,20,19,0.06)] dark:shadow-black/20", statusPanelClass(row[statusKey]))}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">{formatCell(title)}</p>
                  {meta !== undefined && <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{formatCell(meta)}</p>}
                </div>
                {showStatus && <StatusChip value={statusVal} className="max-w-[50%] justify-start" />}
              </div>
              {description !== undefined && <p className="mt-3 text-sm leading-6 text-muted-foreground">{formatCell(description)}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function renderGrid({ node, children }: AdapterArgs<"grid">) {
  const columns = node.props?.columns ?? 2

  return <div className={cn("grid gap-5", columnsClass(columns))}>{children}</div>
}

function renderSection({ node, children }: AdapterArgs<"section">) {
  const props = node.props ?? {}

  return (
    <section className="flex scroll-mt-8 flex-col gap-5">
      <Separator />
      {(props.title || props.description) && (
        <div className="pb-1">
          {props.title && <h2 className="font-serif text-3xl font-medium tracking-[-0.025em] text-foreground">{props.title}</h2>}
          {props.description && <p className="mt-2 max-w-3xl text-muted-foreground">{props.description}</p>}
        </div>
      )}
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

function renderTabs({ node, context, renderNodes }: AdapterArgs<"tabs">) {
  const defaultValue = node.props.defaultValue ?? node.props.items[0]?.value

  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        {node.props.items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {node.props.items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="flex flex-col gap-5 pt-1">
          {renderNodes(item.nodes, context)}
        </TabsContent>
      ))}
    </Tabs>
  )
}

function renderAccordion({ node, context, renderNodes }: AdapterArgs<"accordion">) {
  return (
    <Accordion>
      {node.props.items.map((item, index) => (
        <AccordionItem key={item.title} value={`item-${index}`}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4">{renderNodes(item.nodes, context)}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function TableBlock({
  data,
  columns,
  caption,
  dense = false,
  comparison = false,
  statusKey,
  dataKey,
}: {
  data: Record<string, unknown>[]
  columns?: ArtifactColumn[]
  caption?: string
  dense?: boolean
  comparison?: boolean
  statusKey?: string
  dataKey: string
}) {
  if (!data.length) {
    return <MissingData dataKey={dataKey} />
  }

  const normalizedColumns = normalizeColumns(columns, data)

  const table = (
    <Table>
      {caption && <TableCaption>{caption}</TableCaption>}
      <TableHeader>
        <TableRow>
          {normalizedColumns.map((column) => (
            <TableHead key={column.key} className={cn(dense ? "h-9" : undefined, comparison && "font-mono text-[11px] uppercase tracking-[0.12em]")}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, index) => (
          <TableRow key={index}>
            {normalizedColumns.map((column, columnIndex) => (
              <TableCell
                key={column.key}
                className={cn(
                  dense ? "py-2.5" : undefined,
                  columnIndex === 0 && "font-medium text-foreground",
                  comparison && "align-top whitespace-normal"
                )}
              >
                {statusKey === column.key ? <StatusChip value={row[column.key]} /> : formatCell(row[column.key])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  if (!comparison) return table

  return (
    <>
      {caption && <p className="text-sm text-muted-foreground md:hidden">{caption}</p>}
      <div className="grid gap-3 md:hidden">
        {data.map((row, index) => (
          <MobileRecord key={index} row={row} columns={normalizedColumns} statusKey={statusKey} />
        ))}
      </div>
      <div className="hidden md:block">{table}</div>
    </>
  )
}

function MobileRecord({ row, columns, statusKey }: { row: Record<string, unknown>; columns: { key: string; label: string }[]; statusKey?: string }) {
  const [primary, ...rest] = columns
  const primaryValue = primary ? row[primary.key] : undefined

  return (
    <article className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          {primary && <p className="font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">{formatCell(primaryValue)}</p>}
          {primary && <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{primary.label}</p>}
        </div>
        {statusKey && row[statusKey] !== undefined && <StatusChip value={row[statusKey]} className="max-w-[50%] justify-start" />}
      </div>
      <dl className="mt-4 flex flex-col gap-3">
        {rest
          .filter((column) => column.key !== statusKey)
          .map((column) => (
            <div key={column.key} className="grid gap-1 border-t pt-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{column.label}</dt>
              <dd className="text-sm leading-6 text-muted-foreground">{formatCell(row[column.key])}</dd>
            </div>
          ))}
      </dl>
    </article>
  )
}

function MissingData({ dataKey }: { dataKey: string }) {
  return <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Missing dataset: {dataKey}</p>
}

function TrendPill({ trend, children }: { trend: "up" | "down" | "neutral"; children: ReactNode }) {
  return <Badge variant={trend === "down" ? "destructive" : trend === "neutral" ? "outline" : "secondary"}>{children}</Badge>
}

function StatusChip({ value, className }: { value: unknown; className?: string }) {
  const text = formatCell(value)
  const tone = statusTone(text)

  return <Badge variant={statusBadgeVariant(tone)} className={cn("justify-start", className)}>{text}</Badge>
}

function statusBadgeVariant(tone: ReturnType<typeof statusTone>) {
  if (tone === "danger") return "destructive"
  if (tone === "neutral") return "outline"
  if (tone === "success") return "default"

  return "secondary"
}

function statusTone(value: string) {
  const normalized = value.toLowerCase()

  if (["pass", "passed", "ok", "healthy", "linked", "running", "configured", "done", "yes", "success", "guarded", "checked", "loaded", "shared", "attached", "rendered", "manifested", "enforced"].some((word) => normalized.includes(word))) {
    return "success"
  }

  if (["warn", "warning", "risk", "attention", "partial", "degraded", "drift", "medium"].some((word) => normalized.includes(word))) {
    return "warning"
  }

  if (["fail", "failed", "error", "blocked", "danger", "critical", "high", "leak", "down"].some((word) => normalized.includes(word))) {
    return "danger"
  }

  if (["info", "pending", "next", "review", "neutral", "optional", "preview", "check"].some((word) => normalized.includes(word))) {
    return "accent"
  }

  return "neutral"
}

function statusPanelClass(value: unknown) {
  const tone = statusTone(formatCell(value))

  return cn(
    tone === "success" && "border-l-4 border-l-[var(--olive)]",
    tone === "warning" && "border-l-4 border-l-[var(--clay)]",
    tone === "danger" && "border-l-4 border-l-[var(--rust)]",
    tone === "accent" && "border-l-4 border-l-[var(--clay)]"
  )
}

function tonePanelClass(tone: ArtifactTone | undefined) {
  return cn(
    tone && tone !== "default" && "border-l-4",
    tone === "accent" && "border-l-[var(--clay)]",
    tone === "success" && "border-l-[var(--olive)]",
    tone === "warning" && "border-l-[var(--clay)]",
    tone === "danger" && "border-l-[var(--rust)]"
  )
}

function columnsClass(columns: 1 | 2 | 3 | 4) {
  if (columns === 1) return "grid-cols-1"
  if (columns === 3) return "md:grid-cols-3"
  if (columns === 4) return "md:grid-cols-2 xl:grid-cols-4"

  return "md:grid-cols-2"
}

function getRows(data: VisualArtifactSpec["data"], dataKey: string): Record<string, unknown>[] {
  const dataset = data?.[dataKey]

  if (!Array.isArray(dataset)) {
    return []
  }

  return dataset.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null && !Array.isArray(row))
}

function normalizeColumns(columns: ArtifactColumn[] | undefined, data: Record<string, unknown>[]) {
  const source = columns?.length ? columns : Object.keys(data[0] ?? {})

  return source.map((column) => {
    if (typeof column === "string") {
      return { key: column, label: toTitle(column) }
    }

    return { key: column.key, label: column.label ?? toTitle(column.key) }
  })
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number") return value.toLocaleString()
  if (typeof value === "string") return value
  if (typeof value === "boolean") return value ? "Yes" : "No"

  return JSON.stringify(value)
}

function toTitle(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
