# Visualizer AI-colab annotation format (shipped)

> This doc describes the **comment-only Markdown** produced by the AI-colab "Copy Markdown" button. The previous compact artifact dump format was replaced by a sparse annotation block that references the raw artifact JSON file and lists only the actual comments.

## Output shape

```text
Markdown Annotations

File:
/data/artifacts/<project>/<slug>/artifact.json

File Feedback

I've reviewed this file and have N piece(s) of feedback:

1. (lines X-Y) Feedback on: "<quoted artifact title or node label>"

| <comment body line 1>
| <comment body line 2>

Please address the annotation feedback above.
```

## Rules

- Only emitted when at least one comment exists. With zero comments the formatter returns an empty string and the UI disables Copy Markdown.
- The `File:` line is the public artifact JSON path built from the current project and slug via `artifactDataPath(project, slug)`.
- Comment locations are **line ranges in the canonical artifact JSON** (`JSON.stringify(spec, null, 2)`), not node paths.
- Artifact-level comments point at the artifact title line (top-level `"title"` value), falling back to line 1.
- Node-level comments point at the full JSON object range of the target node. Nested children, tabs, and accordion items are resolved using the same path conventions as the renderer.
- Comments are resolved by `nodeId` first, then `nodePath`. Orphaned comments (no matching node) are emitted at the end with `(lines 1-1)` and the best available label.
- The quoted target label is inferred from the current node (using the existing label heuristics), then falls back to the stored comment label, then `nodeType`/`nodePath`, then `unknown`.
- `"` inside the quoted target text is escaped as `\"`.
- Every line of a multi-line comment body is prefixed with `| `.
- Singular: `"1 piece"`; plural: `"N pieces"`.

## No longer emitted

- The verbose `# Visual Artifact Feedback Package` header.
- Dataset summaries (`## Datasets`).
- Node dumps (`## Nodes`, `@props:`, `@data:`, `@user-comments:`).
- Raw SVG, code, or table previews.

The assumption is that the raw artifact JSON referenced by the `File:` line is supplied to the LLM separately, so the Markdown only carries the human annotations.

## Appendix: old compact format (deprecated)

The previous compact formatter grammar below is kept for historical reference only. New implementations should use the comment-only format above.

---

# Visualizer compact formatter (design)
- Preserve node hierarchy and identity (node path + metadata.id when present).
- Summarize props and data without dumping large arrays, code blocks, or raw HTML.
- Provide explicit, easy-to-find slots for human/agent annotations per node.

Goals / constraints
- Machine-friendly: deterministic node paths (nodes.0, nodes.1.children.2, ...).
- Human-friendly: readable headings and brief summaries.
- Non-executable: never include raw executable HTML/JS; flag or truncate potentially dangerous content (svg-diagram.html).
- Edit-friendly: LLM can propose changes using JSON-path-like selectors or in-band PATCH blocks.

Overview of the format
- Top-level artifact header (slug, title, description, layout, data keys summary).
- Node list; each node is a compact block with 3 required pieces: path, type (+ optional metadata.id), computed label, short props summary, and a small content preview when needed.
- Container nodes show their children indented.
- Data-backed nodes summarize dataset shape and show up to N sample rows rather than full arrays.
- Long content (code, diffs, mermaid, svg html) is truncated with clear "SHOW_MORE" anchors so the client can fetch full content on demand.
- Per-node comment area (ANNOTATION) where users may append comments; these are kept separate from the artifact spec and can be round-tripped.

Candidate grammar (EBNF-ish)

ARTIFACT := HEADER \n NODES_BLOCK
HEADER := "# Artifact" "\n" META_LINES
META_LINES := ("Slug: " STR) "\n" ("Title: " STR) "\n" ("Description: " STR? "\n") ("Layout: " LAYOUT? "\n") ("DataKeys: " DATA_SUMMARY "\n")

NODES_BLOCK := "\nNodes:" "\n" NODE*
NODE := INDENT? "- [" PATH "]" " " TYPE_META_LABEL "\n" INDENT "  props: " PROPS_SUMMARY "\n" [ INDENT "  preview: " PREVIEW "\n" ] [ INDENT "  comment: " ANNOTATION_BLOCK "\n" ]

TYPE_META_LABEL := TYPE (" | id=" ID)? (" | label=\"" LABEL "\"")?
PROPS_SUMMARY := COMMA_SEP(K=V-short)
PREVIEW := SHORT_TEXT | CODE_FENCE_TRUNC
ANNOTATION_BLOCK := ("@" AUTHOR "," TIMESTAMP ": " COMMENT_TEXT)

PATH := dotted numeric path starting with nodes, e.g. nodes.0, nodes.1.children.2, nodes.3.props.items.1.nodes
TYPE := one of ArtifactNode types (stat-card, card, grid, table, data-table, comparison-table, chart, mermaid, code-block, etc.)
ID := metadata.id string (if present)
LABEL := short inferred label (see heuristics)

Formatting rules (compact human-friendly form)
- Use a single dash list for top-level nodes. Use two-space indentation per nesting level.
- Each node line MUST include: [PATH] TYPE | id=ID? | label="LABEL"
- Follow with an indented properties line: two spaces + "props:" and a compact one-line JSON-like summary with primitive values only.
- If the node has textual content (prose, code-block, mermaid, diff, svg-diagram.html) include a "preview:" line with a truncated excerpt.
- For container nodes (card, grid, section) include children below, indented.

Node label heuristics (to make nodes easy to scan)
- heading: use props.text (first 80 chars)
- stat-card / metric: use props.label
- card: use props.title or first child label
- code-block: use props.title or language or first line of code
- mermaid / svg-diagram: props.title or first non-empty line of code/html
- table/data-table/comparison-table/chart/timeline/status-grid: show "dataKey=<key> (N rows)" and columns list (inferred), see Data-backed rules.
- image: show src + alt
- tabs/accordion: show item labels (comma-separated)

Per-node formatting examples (representative)
- Leaf (stat-card)

- [nodes.0] stat-card | id=summary-card | label="Summary"
  props: { label: "Summary", value: "Ready", delta: "+5%", tone: success }
  preview: N/A
  comment: none

- Container (grid with children)

- [nodes.1] grid | label="Grid" 
  props: { columns: 3 }
  children:
    - [nodes.1.children.0] stat-card | label="Agents"
      props: { label: "Agents", value: 3, caption: "ImageDescriptor → ContentGenerator → JsonFormatter" }
    - [nodes.1.children.1] stat-card | label="Retrieval"
      props: { label: "Retrieval", value: "ChromaDB" }

- Code block (truncated)

- [nodes.4] code-block | label="Smoke release" 
  props: { language: bash, title: "Smoke release" }
  preview: ```bash
  git tag smoke-v0.0.1
  git push origin smoke-v0.0.1
  ... (truncated: 10 lines)
  ```
  comment: @alice,2026-07-05T12:03Z: "Please update tag naming"

Data-backed nodes summary rules
- For nodes referencing spec.data[dataKey] (table, data-table, comparison-table, chart, timeline, status-grid, and chart types):
  - If data not present: show "MISSING DATA: data.<dataKey>"
  - Otherwise: show one-line summary: "dataKey=<key> (N rows) columns: [k1, k2, ...]" where columns are inferred from first row(s).
  - Then show up to SAMPLE_ROWS (default 3) sample rows as JSON-minified single-line entries under "preview". If rows > SAMPLE_ROWS, append "... (truncated: N rows omitted)".
  - When rows are wide, truncate cell values to CELL_CHAR_LIMIT (default 200 chars) and annotate truncation.

Data-backed example (comparison-table)

- [nodes.2] comparison-table | label="Checks" 
  props: { dataKey: checks, columns: ["check","result","evidence"], statusKey: result }
  preview: dataKey=checks (12 rows) columns=[check,result,evidence]
    sample(0): { check: "Contract", result: "pass", evidence: "pnpm verify:artifacts" }
    sample(1): { check: "Build", result: "ready", evidence: "pnpm build" }
    sample(2): { check: "Tests", result: "fail", evidence: "-- trimmed --" }

Large arrays / truncation strategy
- Tunable defaults (recommended):
  - ARTIFACT_TOKEN_BUDGET: 2048 tokens (configurable per-run)
  - PER_NODE_MAX: 256 tokens
  - SAMPLE_ROWS: 3
  - SAMPLE_LINES (code/diff): 12 lines (first 12) + LAST_LINES: 3 lines
  - CELL_CHAR_LIMIT: 200 characters per cell value
  - SHOW_FULL_ANCHOR: "<<SHOW_MORE {path}>>" (used to request the full raw content for that path)

Algorithm (high level)
1. Reserve a small fixed header budget (approx 5% of ARTIFACT_TOKEN_BUDGET).
2. Walk nodes top-to-bottom. For each node:
   a. Compute its summary cost. If remainingBudget >= summaryCost (or node is high-priority: heading, stat-card, top-level card), include the detailed summary.
   b. Else include a one-line placeholder: "- [nodes.8] <type> | label=... (omitted: low budget)".
3. For data-backed nodes, always include dataKey + row count + up to SAMPLE_ROWS.
4. For very large artifacts (more than ~50 nodes), switch to sparse mode: include top-level headings, first K nodes per section, and placeholders for the rest.

Show-more anchor
- When a value is truncated (code, diff, svg html, or data rows), append a line:
  preview: ... (truncated)
  fetch: <<SHOW_MORE nodes.4.props.code>>
- Clients can respond to the SHOW_MORE anchor by retrieving the full artifact JSON and extracting the referenced path.

Escaping & security notes
- Never include raw <script> or inline event handlers from svg-diagram.html; instead, detect and mark as "CONTAINS SCRIPT TAGS (sanitized)". The formatter reports presence of <script> or on* attributes and replaces full raw HTML with a sanitized summary plus SHOW_MORE anchor.
- Never include data: URIs or file:// URLs. If these appear, format shows "INVALID URL: file://..." and recommend replacement.
- For markdown/code in previews, always use fenced code blocks specifying language when known, and ensure backticks inside are escaped by closing the fence with 3 backticks and using a higher fence if necessary.
- All preview text MUST be plain text (no HTML rendering) and should be safely escaped for Markdown (angle brackets, backticks) or wrapped in code fences.

How to preserve node identity
- Use the deterministic path (nodes.<i>...) as the canonical identifier in the formatter. Include metadata.id when present in the header of each node block for stability across reorders.
- When agents propose edits, prefer to reference metadata.id if present. If metadata.id is not present, reference the path and include a warning: "path-only reference — add metadata.id to avoid fragility".

Edit / comment affordances for LLMs and humans
- Comments/annotations syntax: add under a node a line starting with "comment:" and then a single-line or multi-line ANNOTATION block.
- Annotation block format (single inline or fenced):
  comment: @<author>,<timestamp>: "<short text>"
  Or multi-line:
  comment: <<ANNOTATION
  @alice,2026-07-05T12:03Z
  Please update tag naming to include date.
  ANNOTATION

- Suggested in-band PATCH format (LLM to propose change):
  PATCH: nodes.3.props.value := "New value"
  PATCH: nodes.2.props.title := null  # to remove
  ADD_NODE: parent=nodes.1 index=2 JSON:{ "type":"text","props":{"text":"New note"}}   
  REMOVE_NODE: nodes.4
  MOVE_NODE: src=nodes.5 dst=nodes.1.children index=0

  Clients parsing the LLM output can treat PATCH lines as explicit actions and apply them to the artifact JSON.

Examples

1) Small architecture brief (from docs)

# Artifact
Slug: runtime-topology
Title: Runtime topology brief
Description: Brief description of the ADK runtime
Layout: default
DataKeys: none

Nodes:
- [nodes.0] text | label="The runtime is a three-stage ADK pipeline"
  props: { text: "The runtime is a three-stage ADK pipeline with explicit retrieval and TTS boundaries.", size: lg }
  preview: N/A
  comment: none

- [nodes.1] grid | label="Grid"
  props: { columns: 3 }
  children:
    - [nodes.1.children.0] stat-card | label="Agents"
      props: { label: "Agents", value: 3, caption: "ImageDescriptor → ContentGenerator → JsonFormatter", tone: accent }
    - [nodes.1.children.1] stat-card | label="Retrieval"
      props: { label: "Retrieval", value: "ChromaDB", caption: "Grounding through embedded docs", tone: success }
    - [nodes.1.children.2] stat-card | label="Output"
      props: { label: "Output", value: "JSON + MP3", caption: "Validated response and narration" }

- [nodes.2] mermaid | label="Runtime topology"
  props: { title: "Runtime topology" }
  preview: ```text
  flowchart LR
    Client[Mobile client] --> API[FastAPI route]
    API --> ADK[ADK sequential agent]
    ADK --> Chroma[(ChromaDB)]
    ADK --> TTS[Cloud TTS]
  ... (truncated: 0 lines)
  ```

2) Data-backed comparison table with truncation

- [nodes.3] comparison-table | label="Checks"
  props: { dataKey: checks, columns: ["check","status","evidence"], statusKey: status }
  preview: dataKey=checks (28 rows) columns=[check,status,evidence]
    sample(0): { check: "Contract", status: "pass", evidence: "pnpm verify:artifacts" }
    sample(1): { check: "Build", status: "ready", evidence: "pnpm build" }
    sample(2): { check: "Tests", status: "fail", evidence: "See build logs (truncated)" }
  fetch: <<SHOW_MORE nodes.3.props.data>>

3) Code-block/truncated diff

- [nodes.4] diff | label="utils.ts"
  props: { language: typescript, mode: unified }
  preview: ```diff
  @@ -1,3 +1,3 @@
  -export function greet(name: string) {
  -  return `Hello, ${name}`;
  +export function greet(name: string) {
  +  return `Hello, ${name}!`;
  }
  ... (truncated: 120 lines)
  ```
  fetch: <<SHOW_MORE nodes.4.props.content>>

Tests (design-level; small unit test cases)
- Test 1: minimal artifact
  Input: artifact with slug/title and a single stat-card node.
  Expect: header lines + one node block containing path nodes.0, type stat-card, label from props.label, props shown inline.

- Test 2: data-backed node with missing data
  Input: comparison-table with props.dataKey="checks" but spec.data undefined.
  Expect: node preview shows "MISSING DATA: data.checks" and no sample rows.

- Test 3: large table truncation
  Input: table with dataKey referencing an array of 200 rows.
  Expect: preview shows "dataKey=... (200 rows) columns=[..]" and exactly SAMPLE_ROWS sample rows, followed by "(truncated: 197 rows omitted)".

- Test 4: long code block truncation
  Input: code-block with 1000 lines.
  Expect: preview shows first SAMPLE_LINES lines and last LAST_LINES lines with a note "(truncated: 985 lines)" and SHOW_MORE anchor.

- Test 5: svg-diagram containing <script>
  Input: svg-diagram.props.html that includes a <script> tag.
  Expect: preview shows "svg-diagram: CONTAINS <script> (sanitized)" and SHOW_MORE anchor.

Implementation notes / heuristics for implementors
- Node path calculation: follow the renderer's deterministic path: nodes.<i> then append ".children.<j>" for container children or ".props.items.<k>.nodes.<m>" for tabs/accordion items; this matches the renderNodes invocation sites.
- Label inference: implement small heuristics in the formatter that mirror the renderer's node-label derivation (title / text / label / first line of content) — keep labels <= 80 chars.
- Data column inference: inspect the first non-empty row and list keys in stable order (sorted alphabetically only if no obvious primary column). For comparison-table, if columns are provided in props, show them in that order.
- Row sampling: pick rows 0..(SAMPLE_ROWS-1). If the dataset seems sorted (date-like xKey) include head + tail samples instead of first N only.
- Size estimates: approximate tokens by characters using ratio 1 token ≈ 4 chars for budget accounting; allow client override of token budget.

Interacting with the formatted output (suggested UX)
- The LLM reads the compact format and can propose PATCH lines or annotate nodes via the comment blocks.
- When the LLM asks to "SHOW_MORE" for a path, a client fetches the artifact JSON and responds with the full value inserted as a quoted block or a follow-up formatted chunk.
- When applying PATCHes, clients should prefer metadata.id references when present. If metadata.id is absent and the formatter lists a path-only reference, consider inserting a generated metadata.id (and announce it in the edit).

Open questions (to decide during implementation)
- Default artifact token budget and per-node caps: recommended defaults are given, but should be configurable by the caller.
- Whether to support a machine-friendly JSON diff format in-band or to rely on explicit PATCH lines. The simple PATCH lines are recommended; a more formal JSON-Patch (RFC6902) adapter can be added later.

Appendix: short quick-reference
- Node header: - [nodes.12] <type> | id=<id?> | label="..."
- props: { k: v, ... } (single-line, primitives only)
- preview: small fenced block or single-line sample
- data previews: "dataKey=<k> (N rows) columns=[...]" + sample rows
- show more: <<SHOW_MORE {path}>>
- comments: comment: <<ANNOTATION\n@author,timestamp\ntext\nANNOTATION



