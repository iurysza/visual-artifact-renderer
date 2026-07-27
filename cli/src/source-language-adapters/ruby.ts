import type { AstMatch, SourceLanguageAdapter } from "./language-adapter.ts"

function callSymbol(match: AstMatch): string | undefined {
  const symbol = /^([^\s(]+)/.exec(match.text.trim())?.[1]
  return symbol?.endsWith(".") ? undefined : symbol
}

function declarationSymbol(match: AstMatch): string | undefined {
  switch (match.ruleId) {
    case "method":
    case "singleton-method":
      return /^\s*def\s+([^\s(;]+)/.exec(match.text)?.[1]
    case "class":
      return /^\s*class\s+([^\s<]+)/.exec(match.text)?.[1]
    case "module":
      return /^\s*module\s+([^\s]+)/.exec(match.text)?.[1]
    case "singleton-class":
      return /^\s*class\s+<<\s+([^\s]+)/.exec(match.text)?.[1]
    default:
      return undefined
  }
}

function assignmentSymbol(match: AstMatch): string | undefined {
  const firstLine = match.text.split("\n", 1)[0]?.trim()
  if (!firstLine) return undefined
  const operator = /\s*(?:\|\|=|&&=|\*\*=|<<=|>>=|[+\-*\/%&|^]=|=(?![=~>]))\s*/.exec(firstLine)
  if (!operator || operator.index === 0) return undefined
  return firstLine.slice(0, operator.index).trim()
}

export const rubySourceLanguageAdapter: SourceLanguageAdapter = {
  id: "ruby",
  variants: [
    {
      extensions: [".rb"],
      astGrepCliLanguage: "ruby",
      astGrepRuleLanguage: "Ruby",
      factsLanguage: "ruby",
    },
  ],
  calls: {
    query: { type: "kind", value: "call" },
    syntaxKind: "call",
    extractSymbol: callSymbol,
  },
  nodes: [
    {
      id: "method",
      astKind: "method",
      syntaxKind: "method",
      focusKind: "declaration",
      scopeKind: "method",
      extractSymbol: declarationSymbol,
    },
    {
      id: "singleton-method",
      astKind: "singleton_method",
      syntaxKind: "singleton_method",
      focusKind: "declaration",
      scopeKind: "method",
      extractSymbol: declarationSymbol,
    },
    {
      id: "class",
      astKind: "class",
      syntaxKind: "class",
      focusKind: "declaration",
      scopeKind: "module",
      extractSymbol: declarationSymbol,
    },
    {
      id: "module",
      astKind: "module",
      syntaxKind: "module",
      focusKind: "declaration",
      scopeKind: "module",
      extractSymbol: declarationSymbol,
    },
    {
      id: "singleton-class",
      astKind: "singleton_class",
      syntaxKind: "singleton_class",
      focusKind: "declaration",
      scopeKind: "module",
      extractSymbol: declarationSymbol,
    },
    {
      id: "do-block",
      astKind: "do_block",
      syntaxKind: "do_block",
      scopeKind: "callback",
    },
    {
      id: "block",
      astKind: "block",
      syntaxKind: "block",
      scopeKind: "callback",
    },
    {
      id: "assignment",
      astKind: "assignment",
      syntaxKind: "assignment",
      focusKind: "assignment",
      extractSymbol: assignmentSymbol,
    },
    {
      id: "operator-assignment",
      astKind: "operator_assignment",
      syntaxKind: "operator_assignment",
      focusKind: "assignment",
      extractSymbol: assignmentSymbol,
    },
    {
      id: "return",
      astKind: "return",
      syntaxKind: "return",
      focusKind: "return",
    },
    ...[
      ["if", "if"],
      ["unless", "unless"],
      ["if-modifier", "if_modifier"],
      ["unless-modifier", "unless_modifier"],
      ["case", "case"],
      ["case-match", "case_match"],
      ["while", "while"],
      ["until", "until"],
      ["for", "for"],
      ["while-modifier", "while_modifier"],
      ["until-modifier", "until_modifier"],
      ["conditional", "conditional"],
    ].map(([id, astKind]) => ({
      id,
      astKind,
      syntaxKind: astKind,
      focusKind: "branch" as const,
    })),
  ],
}
