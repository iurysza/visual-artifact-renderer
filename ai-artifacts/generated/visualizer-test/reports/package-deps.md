# Package dependency groups

Grouped 30 declared packages. Top groups: ui (9), framework (3), data-viz (2), other (8), validation (1).

**Instructions source:** .agents/plans/000-multipass-visual-artifact-generator/000-multipass-visual-artifact-generator.md

## Facts

```json
{
  "totalPackages": 30,
  "topGroups": [
    {
      "group": "ui",
      "count": 9,
      "totalUsage": 53
    },
    {
      "group": "framework",
      "count": 3,
      "totalUsage": 31
    },
    {
      "group": "data-viz",
      "count": 2,
      "totalUsage": 5
    },
    {
      "group": "other",
      "count": 8,
      "totalUsage": 3
    },
    {
      "group": "validation",
      "count": 1,
      "totalUsage": 2
    }
  ],
  "mostUsedPackages": [
    {
      "name": "@base-ui/react",
      "usageCount": 27,
      "kind": "dependency"
    },
    {
      "name": "react",
      "usageCount": 23,
      "kind": "dependency"
    },
    {
      "name": "lucide-react",
      "usageCount": 13,
      "kind": "dependency"
    },
    {
      "name": "class-variance-authority",
      "usageCount": 8,
      "kind": "dependency"
    },
    {
      "name": "next",
      "usageCount": 8,
      "kind": "dependency"
    },
    {
      "name": "recharts",
      "usageCount": 4,
      "kind": "dependency"
    },
    {
      "name": "sonner",
      "usageCount": 2,
      "kind": "dependency"
    },
    {
      "name": "zod",
      "usageCount": 2,
      "kind": "dependency"
    },
    {
      "name": "eslint-config-next",
      "usageCount": 2,
      "kind": "devDependency"
    },
    {
      "name": "clsx",
      "usageCount": 1,
      "kind": "dependency"
    }
  ]
}
```

## Findings

### 30 declared packages across 10 groups

**Evidence:**
- package-deps.json

**Why it matters:** Package groups show what kinds of external capabilities the system relies on and where coupling to third-party code is concentrated.
**Confidence:** high

## Assets

- **Package dependency groups** (json): assets/package-deps.json
  Declared packages grouped by purpose with usage counts from source imports

## Assembly hints

- **technical layers** (secondary): data-table, comparison-table
