# Internal import graph

Extracted 12 internal import edges from 70 source files. Top internal target: src/lib/report-packet.ts.

**Instructions source:** .agents/plans/000-multipass-visual-artifact-generator/000-multipass-visual-artifact-generator.md

## Facts

```json
{
  "sourceFileCount": 70,
  "internalEdgeCount": 12,
  "topInternalTargets": [
    {
      "target": "src/lib/report-packet.ts",
      "count": 4
    },
    {
      "target": "scripts/extract/lib/runner.ts",
      "count": 3
    },
    {
      "target": "src/lib/mermaid-validator.ts",
      "count": 2
    },
    {
      "target": "src/lib/artifact-manifest.ts",
      "count": 1
    },
    {
      "target": "src/lib/artifact-schema.ts",
      "count": 1
    },
    {
      "target": "src/app/globals.css",
      "count": 1
    }
  ],
  "topPackageImports": [
    {
      "package": "@/components",
      "count": 57
    },
    {
      "package": "@/lib",
      "count": 50
    },
    {
      "package": "@base-ui/react",
      "count": 27
    },
    {
      "package": "react",
      "count": 23
    },
    {
      "package": "lucide-react",
      "count": 13
    },
    {
      "package": "node:fs",
      "count": 12
    },
    {
      "package": "node:path",
      "count": 8
    },
    {
      "package": "next",
      "count": 8
    },
    {
      "package": "class-variance-authority",
      "count": 8
    },
    {
      "package": "node:os",
      "count": 5
    }
  ]
}
```

## Findings

### 12 internal import edges across 70 files

**Evidence:**
- internal-imports.json
- dependency-graph.mmd

**Why it matters:** Import relationships reveal coupling, layering, and which modules are central to the architecture.
**Confidence:** high

## Assets

- **Internal import edges** (json): assets/internal-imports.json
  First 500 internal import edges with source and resolved target
- **Dependency graph** (mermaid): assets/dependency-graph.mmd
  Top modules by internal import connectivity

## Assembly hints

- **technical layers** (primary): mermaid
- **integration points** (secondary): data-table
