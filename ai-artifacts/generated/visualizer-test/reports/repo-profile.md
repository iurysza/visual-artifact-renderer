# Repository profile

Profile of visualizer: Next.js, React, Base UI, Tailwind CSS, shadcn/ui, pnpm package manager, 19 dependencies, 2 candidate entry points.

**Instructions source:** .agents/plans/000-multipass-visual-artifact-generator/000-multipass-visual-artifact-generator.md

## Facts

```json
{
  "packageManager": "pnpm",
  "framework": [
    "Next.js",
    "React",
    "Base UI",
    "Tailwind CSS",
    "shadcn/ui"
  ],
  "scripts": {
    "dev": "next dev -p 9999",
    "build": "next build",
    "start": "next start",
    "serve": "node scripts/serve.mjs",
    "lint": "eslint",
    "verify:artifacts": "tsx scripts/verify-artifacts.ts",
    "visual:qa": "node scripts/visual-qa.mjs",
    "extract": "tsx scripts/extract/index.ts",
    "validate:mermaid": "tsx scripts/validate-mermaid.ts",
    "test:mermaid-validator": "tsx scripts/test-mermaid-validator.ts"
  },
  "dependencies": {
    "@base-ui/react": "^1.5.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.4.0",
    "lucide-react": "^1.17.0",
    "mermaid": "^11.15.0",
    "next": "16.2.9",
    "next-themes": "^0.4.6",
    "react": "19.2.4",
    "react-day-picker": "^10.0.1",
    "react-dom": "19.2.4",
    "recharts": "3.8.0",
    "shadcn": "^4.11.0",
    "shiki": "^4.2.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "vaul": "^1.1.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/jsdom": "^28.0.3",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "jsdom": "^29.1.1",
    "tailwindcss": "^4",
    "tsx": "^4.22.4",
    "typescript": "^5"
  },
  "entryPoints": [
    "src/app/layout.tsx",
    "src/app/page.tsx"
  ],
  "testCommands": [
    "test:mermaid-validator: tsx scripts/test-mermaid-validator.ts"
  ],
  "routes": [
    "[project]/[slug]",
    "[project]",
    "components",
    "live-artifact",
    "/"
  ],
  "hasTypeScript": true,
  "hasLint": true,
  "hasTests": true
}
```

## Findings

### Detected frameworks: Next.js, React, Base UI, Tailwind CSS, shadcn/ui

**Evidence:**
- @base-ui/react
- class-variance-authority
- clsx
- date-fns
- lucide-react
- mermaid
- next
- next-themes
- react
- react-day-picker
- react-dom
- recharts
- shadcn
- shiki
- sonner
- tailwind-merge
- tw-animate-css
- vaul
- zod
- @tailwindcss/postcss

**Why it matters:** Framework choice shapes how the system is built, tested, and deployed.
**Confidence:** high

### Package manager: pnpm

**Evidence:**
- Lockfile present (pnpm)

**Why it matters:** Determines install commands, workspace support, and dependency resolution behavior.
**Confidence:** high

### Test commands: test:mermaid-validator: tsx scripts/test-mermaid-validator.ts

**Evidence:**
- dev
- build
- start
- serve
- lint
- verify:artifacts
- visual:qa
- extract
- validate:mermaid
- test:mermaid-validator

**Why it matters:** Test commands reveal the primary feedback loops for changes.
**Confidence:** high

## Assembly hints

- **overview** (primary): stat-card, status-grid
- **technical layers** (secondary): comparison-table
