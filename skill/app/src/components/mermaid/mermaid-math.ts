export const MERMAID_MIN_SCALE = 0.5
export const MERMAID_MAX_SCALE = 5
export const MERMAID_ZOOM_STEP = 1.2
export const MERMAID_KEYBOARD_PAN = 48

export type MermaidViewBox = {
  x: number
  y: number
  width: number
  height: number
}

export type PointerPosition = {
  clientX: number
  clientY: number
}

export function readSvgViewBox(svgElement: SVGSVGElement): MermaidViewBox {
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

export function formatSvgViewBox(viewBox: MermaidViewBox) {
  return [viewBox.x, viewBox.y, viewBox.width, viewBox.height]
    .map((value) => Number(value.toFixed(3)))
    .join(" ")
}

export function getMermaidScale(
  initialViewBox: MermaidViewBox,
  currentViewBox: MermaidViewBox
) {
  return initialViewBox.width / currentViewBox.width
}

export function getSvgPoint(
  svgElement: SVGSVGElement,
  clientX: number,
  clientY: number,
  fallbackViewBox: MermaidViewBox | null
) {
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

export function viewBoxForScaleAtPoint(
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

export function getPointerDistance(
  firstPointer: PointerPosition,
  secondPointer: PointerPosition
) {
  return Math.hypot(
    firstPointer.clientX - secondPointer.clientX,
    firstPointer.clientY - secondPointer.clientY
  )
}

export function getPointerCenter(
  firstPointer: PointerPosition,
  secondPointer: PointerPosition
) {
  return {
    clientX: (firstPointer.clientX + secondPointer.clientX) / 2,
    clientY: (firstPointer.clientY + secondPointer.clientY) / 2,
  }
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
