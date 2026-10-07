// Pure: decisions → Markdown data (no instructions). Decisions D5.
import type { DecisionAnswers, DecisionInfo } from "./plan-spec"

export function formatDecisionsMarkdown(title: string, decisions: readonly DecisionInfo[], answers: DecisionAnswers): string {
  const lines = [`## Decisions: ${title}`]
  for (const decision of decisions) {
    const { options } = decision.node.props
    const labelOf = (ids: readonly string[], other?: string) =>
      ids.map((id) => (id === "other" ? `Other: ${other ?? ""}`.trim() : options.find((option) => option.id === id)?.label ?? id)).join(", ") || "(none)"
    const suggestedIds = options.filter((option) => option.suggested).map((option) => option.id)
    const answer = answers[decision.askId] ?? { optionIds: suggestedIds, source: "suggested" }
    const same = answer.optionIds.length === suggestedIds.length && answer.optionIds.every((id) => suggestedIds.includes(id))
    const where = decision.claimLabel ? ` (claim ${decision.claimLabel})` : ""
    const suffix = same ? " (suggested)" : ` (changed from suggested: ${labelOf(suggestedIds)})`
    lines.push(`- ${decision.askId}${where}: ${labelOf(answer.optionIds, answer.other)}${suffix}`)
  }
  return lines.join("\n") + "\n"
}
