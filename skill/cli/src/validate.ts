import type { ArtifactContract, ArtifactSpec, NodeDef } from "./types.ts"

const KEBAB_CASE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined"
  if (value === null) return "null"
  if (typeof value === "string") {
    if (value.length === 0) return "empty string"
    if (value.length > 40) return `string "${value.slice(0, 40)}..."`
    return `string "${value}"`
  }
  if (typeof value === "number") return `number ${value}`
  if (typeof value === "boolean") return `boolean ${value}`
  if (Array.isArray(value)) return `array with ${value.length} items`
  return "object"
}

function humanPath(label: string): string {
  const match = label.match(/^nodes\[(\d+)\](?:<([\w-]+)>)?(.*\.props\.)([\w\[\].]+)$/)
  if (!match) return label
  const [, index, type, rest, prop] = match
  const node = type ? `${type} at nodes[${index}]` : `node at nodes[${index}]`
  const nested = rest
    ? rest
        .slice(0, -".props.".length)
        .replace(/^\./, "")
        .replace(/\./g, " → ")
    : ""
  const itemIndex = prop.match(/items\[(\d+)\]\.(\w+)/)
  if (itemIndex) {
    const [, itemIdx, itemProp] = itemIndex
    return `${node}${nested ? ` → ${nested}` : ""} → items[${itemIdx}] → ${itemProp}`
  }
  return `${node}${nested ? ` → ${nested}` : ""} → ${prop}`
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ValidationError(`${humanPath(label)} must be a non-empty string (got ${describeValue(value)})`)
  }
  return value
}

function assertOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined
  return assertString(value, label)
}

function assertBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${humanPath(label)} must be a boolean (got ${describeValue(value)})`)
  }
  return value
}

function assertNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`${humanPath(label)} must be a number (got ${describeValue(value)})`)
  }
  return value
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${humanPath(label)} must be an array (got ${describeValue(value)})`)
  }
  value.forEach((item, index) => assertString(item, `${label}[${index}]`))
  return value as string[]
}

function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(`${humanPath(label)} must be an object (got ${describeValue(value)})`)
  }
  return value as Record<string, unknown>
}

function propIsOptional(signature: string): boolean {
  const trimmed = signature.trim()
  return trimmed.endsWith("?") || /^(string|number|integer|boolean)\?(\s|$)/.test(trimmed)
}

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim()
  const primitiveOptional = trimmed.match(/^(string|number|integer|boolean)\?(\s.*)?$/)
  if (primitiveOptional) return `${primitiveOptional[1]}${primitiveOptional[2] ?? ""}`.trim()
  return trimmed.endsWith("?") ? trimmed.slice(0, -1).trim() : trimmed
}

function validateEnum(value: unknown, signature: string, label: string): boolean {
  if (!signature.includes(" | ") || signature.includes("string") || signature.includes("number")) return false
  const values = signature.split("|").map(part => part.trim().replace(/^"|"$/g, ""))
  if (values.every(item => /^\d+$/.test(item))) {
    const numeric = assertNumber(value, label)
    if (!values.includes(String(numeric))) {
      throw new ValidationError(`${humanPath(label)} must be one of: ${values.join(", ")}`)
    }
    return true
  }
  const text = assertString(value, label)
  if (!values.includes(text)) {
    throw new ValidationError(`${humanPath(label)} must be one of: ${values.join(", ")}`)
  }
  return true
}

function validateNumberRange(value: number, signature: string, label: string): void {
  const range = signature.match(/(\d+)-(\d+)/)
  if (range && (value < Number(range[1]) || value > Number(range[2]))) {
    throw new ValidationError(`${humanPath(label)} must be between ${range[1]} and ${range[2]}`)
  }
}

type ObjectArrayField = {
  key: string
  optional: boolean
  signature: string
}

function parseObjectArrayField(field: string): ObjectArrayField {
  const match = field.match(/^([A-Za-z0-9_-]+)(\?)?(?::\s*(.+))?$/)
  if (!match) {
    throw new ValidationError(`Unsupported object-array contract field: ${field}`)
  }
  return {
    key: match[1],
    optional: Boolean(match[2]),
    signature: match[3]?.trim() ?? "string",
  }
}

function validateNoExtraKeys(value: Record<string, unknown>, allowedKeys: string[], label: string): void {
  Object.keys(value).forEach(key => {
    if (!allowedKeys.includes(key)) {
      throw new ValidationError(`${humanPath(`${label}.${key}`)} is not supported`)
    }
  })
}

function validateFileTreeItems(value: unknown, label: string, requireNonEmpty: boolean): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${humanPath(label)} must be an array (got ${describeValue(value)})`)
  }
  if (requireNonEmpty && value.length === 0) {
    throw new ValidationError(`${humanPath(label)} must be a non-empty array`)
  }

  value.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`
    const itemObj = assertPlainObject(item, itemLabel)
    validateNoExtraKeys(itemObj, ["name", "type", "children"], itemLabel)
    assertString(itemObj.name, `${itemLabel}.name`)
    if (itemObj.type !== undefined) {
      validateEnum(itemObj.type, '"file" | "directory"', `${itemLabel}.type`)
    }
    if (itemObj.children !== undefined) {
      validateFileTreeItems(itemObj.children, `${itemLabel}.children`, false)
    }
  })
}

function validateObjectArrayField(value: unknown, field: ObjectArrayField, label: string): void {
  const normalized = normalizeSignature(field.signature)
  if (normalized === "nodes[]") {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${humanPath(label)} must be an array (got ${describeValue(value)})`)
    }
    if (value.length === 0) {
      throw new ValidationError(`${humanPath(label)} must be a non-empty array`)
    }
    return
  }
  if (normalized === "file-tree[]") {
    validateFileTreeItems(value, label, false)
    return
  }
  validatePropValue(value, normalized, label)
}

function validateObjectArray(value: unknown, signature: string, label: string): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${humanPath(label)} must be an array (got ${describeValue(value)})`)
  }
  if (value.length === 0) {
    throw new ValidationError(`${humanPath(label)} must be a non-empty array`)
  }

  const shape = signature.match(/^\{\s*(.+?)\s*\}\[\]$/)?.[1]
  if (!shape) return

  const fields = shape.split(",").map(field => parseObjectArrayField(field.trim())).filter(Boolean)
  const allowedKeys = fields.map(field => field.key)
  value.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`
    const itemObj = assertPlainObject(item, itemLabel)
    validateNoExtraKeys(itemObj, allowedKeys, itemLabel)
    fields.forEach(field => {
      const childLabel = `${itemLabel}.${field.key}`
      const child = itemObj[field.key]
      if (child === undefined) {
        if (!field.optional) throw new ValidationError(`${humanPath(childLabel)} is required`)
        return
      }
      validateObjectArrayField(child, field, childLabel)
    })
  })
}

function validatePropValue(value: unknown, signature: string, label: string): void {
  const normalized = normalizeSignature(signature)

  if (validateEnum(value, normalized, label)) return

  if (normalized === "string") {
    assertString(value, label)
    return
  }
  if (normalized === "number" || normalized.startsWith("number ")) {
    const numeric = assertNumber(value, label)
    validateNumberRange(numeric, normalized, label)
    return
  }
  if (normalized === "integer" || normalized.startsWith("integer ")) {
    const numeric = assertNumber(value, label)
    if (!Number.isInteger(numeric)) {
      throw new ValidationError(`${humanPath(label)} must be an integer`)
    }
    validateNumberRange(numeric, normalized, label)
    return
  }
  if (normalized === "boolean") {
    assertBoolean(value, label)
    return
  }
  if (normalized === "string | number") {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new ValidationError(`${humanPath(label)} must be a string or number (got ${describeValue(value)})`)
    }
    if (typeof value === "string") assertString(value, label)
    return
  }
  if (normalized === "string[]") {
    assertStringArray(value, label)
    return
  }
  if (normalized === "(string | { key, label? })[]") {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${humanPath(label)} must be an array (got ${describeValue(value)})`)
    }
    if (value.length === 0) {
      throw new ValidationError(`${humanPath(label)} must be a non-empty array`)
    }
    value.forEach((item, index) => {
      if (typeof item === "string") {
        assertString(item, `${label}[${index}]`)
        return
      }
      const itemObj = assertPlainObject(item, `${label}[${index}]`)
      validateNoExtraKeys(itemObj, ["key", "label"], `${label}[${index}]`)
      assertString(itemObj.key, `${label}[${index}].key`)
      assertOptionalString(itemObj.label, `${label}[${index}].label`)
    })
    return
  }
  if (normalized.startsWith("{") && normalized.endsWith("[]")) {
    validateObjectArray(value, normalized, label)
  }
}

function validateProps(props: Record<string, unknown>, nodeDef: NodeDef, path: string): void {
  const propDefs = nodeDef.props ?? {}
  Object.keys(props).forEach(key => {
    if (!(key in propDefs)) {
      throw new ValidationError(`${humanPath(`${path}.props.${key}`)} is not supported`)
    }
  })

  Object.entries(propDefs).forEach(([key, signature]) => {
    const value = props[key]
    const label = `${path}.props.${key}`
    if (value === undefined) {
      if (!propIsOptional(signature)) throw new ValidationError(`${humanPath(label)} is required`)
      return
    }
    validatePropValue(value, signature, label)
  })
}

function validateNode(
  node: unknown,
  data: Record<string, unknown> | undefined,
  path: string,
  contract: ArtifactContract,
): void {
  const obj = assertPlainObject(node, path)
  const type = assertString(obj.type as unknown as string, `${path}.type`)
  const nodeLabel = `${path}<${type}>`

  if (!contract.nodeTypes.includes(type)) {
    throw new ValidationError(
      `${path}.type "${type}" is not a supported node type. ` +
        `Supported types: ${contract.nodeTypes.join(", ")}`,
    )
  }

  const nodeDef = contract.nodes[type]
  const props = assertPlainObject(obj.props ?? {}, `${path}.props`)
  validateProps(props, nodeDef, `${path}<${type}>`)
  const limits = nodeDef.limits ?? {}

  if (nodeDef.requiresData && props.dataKey !== undefined) {
    const dataKey = assertString(props.dataKey, `${path}<${type}>.props.dataKey`)
    const dataset = data?.[dataKey]
    if (!Array.isArray(dataset)) {
      throw new ValidationError(`data.${dataKey} must be an array (required by ${path})`)
    }
    if (dataset.length > contract.globalLimits.dataRowsMax) {
      throw new ValidationError(
        `data.${dataKey} has ${dataset.length} rows, max allowed is ${contract.globalLimits.dataRowsMax}`,
      )
    }
    dataset.forEach((row, rowIndex) => {
      if (typeof row !== "object" || row === null) {
        throw new ValidationError(`data.${dataKey}[${rowIndex}] must be an object`)
      }
      const rowObj = row as Record<string, unknown>
      Object.entries(rowObj).forEach(([key, value]) => {
        if (typeof value === "string" && value.length > contract.globalLimits.dataStringMax) {
          throw new ValidationError(
            `data.${dataKey}[${rowIndex}].${key} is ${value.length} chars, max allowed is ${contract.globalLimits.dataStringMax}`,
          )
        }
      })
    })
  }

  if (limits.status) {
    const statusKey = props.statusKey as string | undefined
    const dataKey = props.dataKey as string | undefined
    const dataset = dataKey !== undefined ? data?.[dataKey] : undefined
    if (statusKey && Array.isArray(dataset)) {
      dataset.forEach((row, rowIndex) => {
        const rowObj = row as Record<string, unknown>
        const statusValue = rowObj[statusKey]
        if (typeof statusValue === "string" && statusValue.length > limits.status!) {
          throw new ValidationError(
            `data.${dataKey}[${rowIndex}].${statusKey} is ${statusValue.length} chars, max allowed for status is ${limits.status}. ` +
              `Keep status values short (e.g. "ok", "pending"). Use description for longer text.`,
          )
        }
      })
    }
  }

  if (type === "image" && typeof props.src === "string" && /^file:\/\//i.test(props.src)) {
    throw new ValidationError(`${nodeLabel} → src must not use file:// URLs`)
  }

  if (type === "button" && typeof props.href === "string" && /^file:\/\//i.test(props.href)) {
    throw new ValidationError(`${nodeLabel} → href must not use file:// URLs`)
  }

  if (type === "flow" && Array.isArray(props.items)) {
    const items = props.items as unknown[]
    const maxItems = limits.items ?? 6
    if (items.length < 2) {
      throw new ValidationError(`${path}.props.items must have at least 2 items`)
    }
    if (items.length > maxItems) {
      throw new ValidationError(`${path}.props.items has ${items.length} items, max allowed is ${maxItems}`)
    }
    items.forEach((item: unknown, index: number) => {
      const itemObj = assertPlainObject(item, `${path}.props.items[${index}]`)
      assertString(itemObj.title, `${path}.props.items[${index}].title`)
      const itemStatus = itemObj.status
      const maxStatus = limits.itemStatus ?? 16
      if (itemStatus && typeof itemStatus === "string" && itemStatus.length > maxStatus) {
        throw new ValidationError(
          `${path}.props.items[${index}].status is ${itemStatus.length} chars, max allowed is ${maxStatus}`,
        )
      }
    })
  }

  if (nodeDef.children === "nodes" && Array.isArray(obj.children)) {
    const maxChildren = limits.children ?? 10
    if (obj.children.length > maxChildren) {
      throw new ValidationError(`${path} children has ${obj.children.length} items, max allowed is ${maxChildren}`)
    }
    obj.children.forEach((child: unknown, index: number) =>
      validateNode(child, data, `${path}.children[${index}]`, contract),
    )
  }

  if (type === "tabs" && Array.isArray(props.items)) {
    const items = props.items as unknown[]
    const maxItems = limits.items ?? 5
    if (items.length > maxItems) {
      throw new ValidationError(`${path}.props.items has ${items.length} items, max allowed is ${maxItems}`)
    }
    items.forEach((item: unknown, index: number) => {
      const itemObj = assertPlainObject(item, `${path}.props.items[${index}]`)
      assertString(itemObj.value, `${path}<tabs>.props.items[${index}].value`)
      assertString(itemObj.label, `${path}<tabs>.props.items[${index}].label`)
      const nodes = itemObj.nodes
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new ValidationError(`${path}.props.items[${index}].nodes must be a non-empty array`)
      }
      nodes.forEach((child: unknown, childIndex: number) =>
        validateNode(child, data, `${path}.props.items[${index}].nodes[${childIndex}]`, contract),
      )
    })
  }

  if (type === "accordion" && Array.isArray(props.items)) {
    const items = props.items as unknown[]
    const maxItems = limits.items ?? 8
    if (items.length > maxItems) {
      throw new ValidationError(`${path}.props.items has ${items.length} items, max allowed is ${maxItems}`)
    }
    items.forEach((item: unknown, index: number) => {
      const itemObj = assertPlainObject(item, `${path}.props.items[${index}]`)
      assertString(itemObj.title, `${path}.props.items[${index}].title`)
      const nodes = itemObj.nodes
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new ValidationError(`${path}.props.items[${index}].nodes must be a non-empty array`)
      }
      nodes.forEach((child: unknown, childIndex: number) =>
        validateNode(child, data, `${path}.props.items[${index}].nodes[${childIndex}]`, contract),
      )
    })
  }

  if (limits.text && typeof props.text === "string" && props.text.length > limits.text) {
    throw new ValidationError(`${nodeLabel} → text is ${props.text.length} chars, max allowed is ${limits.text}`)
  }
  if (limits.label && typeof props.label === "string" && props.label.length > limits.label) {
    throw new ValidationError(`${nodeLabel} → label is ${props.label.length} chars, max allowed is ${limits.label}`)
  }
  if (limits.code && typeof props.code === "string" && props.code.length > limits.code) {
    throw new ValidationError(`${nodeLabel} → code is ${props.code.length} chars, max allowed is ${limits.code}`)
  }
}

export function validateSpec(spec: unknown, contract: ArtifactContract): ArtifactSpec {
  const obj = assertPlainObject(spec, "spec")

  if (obj.slug === undefined) {
    throw new ValidationError("slug is required")
  }
  const slug = assertString(obj.slug, "slug")
  if (!KEBAB_CASE_RE.test(slug)) {
    throw new ValidationError(`slug "${slug}" must be kebab-case (lowercase letters, numbers, and single hyphens)`)
  }
  if (slug.length > 80) {
    throw new ValidationError(`slug "${slug}" is ${slug.length} chars, max allowed is 80`)
  }

  if (obj.title === undefined) {
    throw new ValidationError("title is required")
  }
  const title = assertString(obj.title, "title")
  if (title.length > 120) {
    throw new ValidationError(`title is ${title.length} chars, max allowed is 120`)
  }

  const description = assertOptionalString(obj.description, "description")
  if (description !== undefined && description.length > 200) {
    throw new ValidationError(`description is ${description.length} chars, max allowed is 200`)
  }

  let layout: { type?: "default" | "grid"; columns?: number } | undefined
  if (obj.layout !== undefined) {
    const layoutObj = assertPlainObject(obj.layout, "layout")
    if (layoutObj.type !== undefined && layoutObj.type !== "default" && layoutObj.type !== "grid") {
      throw new ValidationError("layout.type must be 'default' or 'grid'")
    }
    if (
      layoutObj.columns !== undefined &&
      (typeof layoutObj.columns !== "number" ||
        !Number.isInteger(layoutObj.columns) ||
        layoutObj.columns < 1 ||
        layoutObj.columns > 4)
    ) {
      throw new ValidationError("layout.columns must be an integer between 1 and 4")
    }
    layout = {
      type: layoutObj.type as "default" | "grid" | undefined,
      columns: layoutObj.columns as number | undefined,
    }
  }

  const data = obj.data === undefined ? undefined : assertPlainObject(obj.data, "data")
  if (data !== undefined) {
    const dataKeys = Object.keys(data)
    if (dataKeys.length > 20) {
      throw new ValidationError(`data has ${dataKeys.length} datasets, max allowed is 20`)
    }
  }

  if (obj.nodes === undefined) {
    throw new ValidationError("nodes is required")
  }
  if (!Array.isArray(obj.nodes)) {
    throw new ValidationError("nodes must be an array")
  }
  if (obj.nodes.length === 0) {
    throw new ValidationError("nodes must be a non-empty array")
  }
  if (obj.nodes.length > 30) {
    throw new ValidationError(`nodes has ${obj.nodes.length} items, max allowed is 30`)
  }

  const nodes = obj.nodes as unknown[]
  nodes.forEach((node, index) => validateNode(node, data, `nodes[${index}]`, contract))

  return { slug, title, description, layout, data, nodes }
}
