import { mkdir, rm, utimes, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const target = resolve(process.argv[2] ?? "/tmp/visualizer-alternative-home-fixtures")
const types = ["explainer", "dashboard", "review", "comparison", "report", "plan", "diagram", "idea"]
const projects = ["visualizer", "agents", "dotfiles", "thought-box"]
const titles = [
  "Renderer adapter coverage",
  "Artifact index architecture",
  "Release readiness review",
  "Home library alternatives",
  "Annotation boundary report",
  "Tooling migration plan",
  "Runtime request flow",
  "Artifacts as workspace memory",
]

await rm(target, { recursive: true, force: true })

for (let index = 0; index < 24; index++) {
  const project = projects[index % projects.length]
  const artifactType = types[index % types.length]
  const slug = `${artifactType}-${String(index + 1).padStart(2, "0")}`
  const bundle = resolve(target, project, slug)
  const modifiedAt = new Date(Date.now() - index * 3 * 60 * 60 * 1000)
  await mkdir(bundle, { recursive: true })
  const artifactPath = resolve(bundle, "artifact.json")
  await writeFile(artifactPath, JSON.stringify({
    slug,
    title: `${titles[index % titles.length]} ${index + 1}`,
    description: `A focused ${artifactType} covering the current ${project} work and its implementation details.`,
    artifactType,
    topics: [project, index % 2 === 0 ? "runtime" : "workflow"],
    createdAt: modifiedAt.toISOString(),
    nodes: [{ type: "text", props: { text: "Visual QA fixture." } }],
  }, null, 2))
  await utimes(artifactPath, modifiedAt, modifiedAt)
}

console.log(target)
