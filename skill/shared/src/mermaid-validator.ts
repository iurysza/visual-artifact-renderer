import type MermaidNS from "mermaid";

let mermaidModule: typeof MermaidNS | null = null;

// Mermaid's bundled DOMPurify calls `createDOMPurify()` at module load time,
// using `getGlobal()` which returns `globalThis.window`. If a DOM isn't set
// up before the import, DOMPurify is unsupported and `purify.sanitize` is
// undefined. jsdom crashes in Bun, so we use linkedom (lighter, Bun-safe).
async function ensureDom(): Promise<void> {
  if (typeof window !== "undefined" && typeof document !== "undefined") return;
  try {
    const { parseHTML } = await import("linkedom");
    const dom = parseHTML("<!DOCTYPE html><html><body></body></html>");
    const g = globalThis as Record<string, unknown>;
    g.window = dom.window;
    g.document = dom.document;
    g.HTMLElement = dom.window.HTMLElement;
  } catch {
    // linkedom not available; DOMPurify-dependent diagrams may fail
  }
}

async function getMermaid(): Promise<typeof MermaidNS> {
  if (!mermaidModule) {
    await ensureDom();
    mermaidModule = (await import("mermaid")).default;
  }
  return mermaidModule;
}

export interface MermaidValidationIssue {
  line: number;
  column: number;
  severity: "error" | "warning";
  message: string;
  rule: string;
  suggestion?: string;
}

export interface MermaidValidationResult {
  valid: boolean;
  diagramType?: string;
  errors: MermaidValidationIssue[];
  warnings: MermaidValidationIssue[];
}

const SUPPORTED_DIAGRAM_TYPES = new Set([
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "erDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "journey",
  "gantt",
  "pie",
  "pieChart",
  "requirementDiagram",
  "gitGraph",
  "gitgraph",
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "mindmap",
  "timeline",
  "sankey",
  "xychart",
  "xyChart",
  "block",
  "block-beta",
  "networkArchitecture",
  "packet",
]);

const DIAGRAM_TYPE_HINTS: Record<string, string> = {
  flowchart: "flowchart TD\n  A --> B",
  sequenceDiagram: "sequenceDiagram\n  A->>B: message",
  classDiagram: "classDiagram\n  ClassA --> ClassB",
  erDiagram: "erDiagram\n  USER ||--o{ ORDER : places",
  stateDiagram: "stateDiagram\n  [*] --> State",
  gantt: "gantt\n  title Project",
  pie: "pie\n  title Distribution",
};

function splitLines(input: string): string[] {
  return input.split(/\r?\n/);
}

function detectDiagramType(lines: string[]): string | undefined {
  let inFrontmatter = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%")) continue;
    if (trimmed === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;
    const firstWord = trimmed.split(/\s+/)[0];
    return firstWord;
  }
  return undefined;
}

function lintFrontmatter(lines: string[]): MermaidValidationIssue[] {
  const issues: MermaidValidationIssue[] = [];
  if (!lines[0]?.trim().startsWith("---")) return issues;

  let closed = false;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      closed = true;
      break;
    }
  }
  if (!closed) {
    issues.push({
      line: 1,
      column: 1,
      severity: "error",
      rule: "frontmatter-closed",
      message: "Frontmatter block opened with '---' but never closed.",
      suggestion: "Add a closing '---' line after the config block.",
    });
  }
  return issues;
}

function lintClassDiagramBraces(lines: string[]): MermaidValidationIssue[] {
  const issues: MermaidValidationIssue[] = [];
  let openLine: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.replace(/%%.*$/, "");
    const openCount = (stripped.match(/\{/g) || []).length;
    const closeCount = (stripped.match(/\}/g) || []).length;

    if (openCount > 0 && openLine === null && closeCount === 0) {
      openLine = i + 1;
    }

    if (openLine !== null && closeCount > openCount) {
      // closed
      openLine = null;
    }
  }

  if (openLine !== null) {
    issues.push({
      line: openLine,
      column: lines[openLine - 1].indexOf("{") + 1 || 1,
      severity: "error",
      rule: "class-brace-unbalanced",
      message: "Class definition has an opening '{' without a matching '}'.",
      suggestion: "Close the class block with '}' on its own line.",
    });
  }

  return issues;
}

function lintCommonMistakes(
  lines: string[],
  diagramType: string | undefined,
): MermaidValidationIssue[] {
  const issues: MermaidValidationIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Braces inside comments break some Mermaid parsers
    if (trimmed.startsWith("%%") && /[{}]/.test(trimmed)) {
      issues.push({
        line,
        column: trimmed.search(/[{}]/) + 1,
        severity: "warning",
        rule: "comment-special-chars",
        message:
          "Avoid '{' or '}' inside '%%' comments; they can confuse the parser.",
        suggestion: "Rephrase the comment without braces.",
      });
      continue;
    }

    if (trimmed.startsWith("%%")) continue;

    // Flowchart: A -- B (missing arrow shaft)
    if (
      (diagramType === "flowchart" || diagramType === "graph") &&
      /\b\w+\s+--\s+\w+\b/.test(raw) &&
      !/(--\[|--\(|---|-->)/.test(raw)
    ) {
      issues.push({
        line,
        column: raw.indexOf("--") + 1,
        severity: "error",
        rule: "flowchart-invalid-link",
        message:
          "Flowchart link looks incomplete. Use '-->' for an arrow, '---' for a plain link, or '.->' for dotted.",
        suggestion: "Change 'A -- B' to 'A --> B' or 'A --- B'.",
      });
    }

    // Sequence: -->(?) maybe user meant -->>
    if (
      diagramType === "sequenceDiagram" &&
      /\w+--[^>]\w+/.test(raw.replace(/\s/g, ""))
    ) {
      issues.push({
        line,
        column: raw.indexOf("--") + 1,
        severity: "error",
        rule: "sequence-invalid-arrow",
        message:
          "Sequence diagram dotted arrow must be '-->>' or '--)'.",
        suggestion: "Use 'A-->>B: msg' for a dotted arrow.",
      });
    }

  }

  return issues;
}

type MermaidParseError = {
  message?: string;
  hash?: {
    loc?: {
      first_line?: number;
      first_column?: number;
    };
    expected?: string[];
  };
};

function parseMermaidError(
  error: unknown,
  input: string,
): MermaidValidationIssue[] {
  const issues: MermaidValidationIssue[] = [];
  const err = error as MermaidParseError;

  if (err.hash) {
    const { first_line, first_column } = err.hash.loc || {};
    const line = first_line ?? 1;
    const column = first_column ?? 1;
    const expected = Array.isArray(err.hash.expected)
      ? err.hash.expected.map((e: string) => e.replace(/^'|'$/g, "")).join(", ")
      : undefined;

    let message = err.message || "Parse error";
    // Strip the ASCII art pointer block from Mermaid's message if present,
    // but keep the "Expecting ..." hint.
    message = message
      .replace(/\n+\.\.*[\s\S]*?\^\n*/, " ")
      .replace(/Parse error on line \d+:\s*/, "")
      .trim();

    const alreadyHasExpected = /expecting/i.test(message);
    issues.push({
      line,
      column,
      severity: "error",
      rule: "mermaid-parse",
      message: expected && !alreadyHasExpected
        ? `${message}. Expected one of: ${expected}.`
        : message,
      suggestion: "Check the syntax at the reported location.",
    });
    return issues;
  }

  // Fallback for non-hash errors (e.g. DOMPurify crash, unknown diagram type)
  const message = err?.message || String(error);
  const lines = splitLines(input);

  // Try to find a relevant line for the error
  let line = 1;
  if (message.toLowerCase().includes("class")) {
    line = lines.findIndex((l) => l.trim().startsWith("class ")) + 1 || 1;
  } else if (message.toLowerCase().includes("diagram type")) {
    line = lines.findIndex((l) => {
      const t = l.trim();
      return t && !t.startsWith("%%") && !t.startsWith("---");
    }) + 1 || 1;
  }

  issues.push({
    line,
    column: 1,
    severity: "error",
    rule: "mermaid-parse",
    message,
    suggestion:
      "This error was raised while parsing. Look for unclosed blocks, typos, or unsupported syntax near the reported line.",
  });

  return issues;
}

/**
 * Validate a Mermaid diagram string.
 *
 * Returns structured errors/warnings so an LLM can iterate and fix the diagram.
 */
function stripMarkdownFences(input: string): string {
  return input
    .replace(/^\s*```\s*mermaid\s*\n/i, "")
    .replace(/\n\s*```\s*$/i, "")
    .replace(/^\s*```\s*\n/i, "")
    .trim();
}

export async function validateMermaid(
  input: string,
): Promise<MermaidValidationResult> {
  const normalized = stripMarkdownFences(input)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = splitLines(normalized);
  const issues: MermaidValidationIssue[] = [];

  // 1. Frontmatter
  issues.push(...lintFrontmatter(lines));

  // 2. Diagram type detection
  const diagramType = detectDiagramType(lines);
  if (!diagramType) {
    issues.push({
      line: 1,
      column: 1,
      severity: "error",
      rule: "missing-diagram-type",
      message:
        "No diagram type found. The first non-comment line must declare a diagram type.",
      suggestion: `Start with one of: ${Array.from(SUPPORTED_DIAGRAM_TYPES).slice(0, 8).join(", ")}, ...`,
    });
    return { valid: false, errors: issues, warnings: [] };
  }

  if (!SUPPORTED_DIAGRAM_TYPES.has(diagramType)) {
    const hint = DIAGRAM_TYPE_HINTS[diagramType.toLowerCase()];
    issues.push({
      line: lines.findIndex((l) => l.trim().startsWith(diagramType)) + 1 || 1,
      column: 1,
      severity: "error",
      rule: "unknown-diagram-type",
      message: `Unknown or unsupported diagram type: '${diagramType}'.`,
      suggestion: hint || `Use a supported diagram type such as 'flowchart', 'sequenceDiagram', or 'classDiagram'.`,
    });
    return { valid: false, errors: issues, warnings: [] };
  }

  // 3. Diagram-specific pre-parse linting
  if (diagramType === "classDiagram") {
    issues.push(...lintClassDiagramBraces(lines));
  }
  issues.push(...lintCommonMistakes(lines, diagramType));

  // If pre-parse errors exist, stop before invoking the parser to avoid
  // DOMPurify/runtime crashes on malformed class diagrams.
  const preParseErrors = issues.filter((i) => i.severity === "error");
  if (preParseErrors.length > 0) {
    return {
      valid: false,
      diagramType,
      errors: issues.filter((i) => i.severity === "error"),
      warnings: issues.filter((i) => i.severity === "warning"),
    };
  }

  // 4. Official Mermaid parser
  try {
    const mermaid = await getMermaid();
    mermaid.initialize({
      securityLevel: "loose",
      startOnLoad: false,
    });
    const result = await mermaid.parse(normalized);
    return {
      valid: true,
      diagramType: result.diagramType ?? diagramType,
      errors: [],
      warnings: issues.filter((i) => i.severity === "warning"),
    };
  } catch (error) {
    const parseIssues = parseMermaidError(error, normalized);
    issues.push(...parseIssues);
  }

  return {
    valid: false,
    diagramType,
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning"),
  };
}

/**
 * Format validation result as a concise report for an LLM.
 */
export function formatValidationReport(
  result: MermaidValidationResult,
): string {
  if (result.valid && result.warnings.length === 0) {
    return `Valid${result.diagramType ? ` (${result.diagramType})` : ""}.`;
  }

  const lines: string[] = [];
  if (result.diagramType) {
    lines.push(`Diagram type: ${result.diagramType}`);
  }

  for (const err of result.errors) {
    lines.push(
      `[ERROR] line ${err.line}:${err.column} (${err.rule}) ${err.message}${err.suggestion ? ` → ${err.suggestion}` : ""}`,
    );
  }
  for (const warn of result.warnings) {
    lines.push(
      `[WARN] line ${warn.line}:${warn.column} (${warn.rule}) ${warn.message}${warn.suggestion ? ` → ${warn.suggestion}` : ""}`,
    );
  }

  return lines.join("\n");
}
