import type { AstMatch, SourceLanguageAdapter } from "./language-adapter.ts"

function declarationSymbol(match: AstMatch): string | undefined {
  const { ruleId, text } = match
  if (ruleId === "function-declaration" || ruleId === "function-expression") {
    return /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(text)?.[1]
  }
  if (ruleId === "variable-declarator" && text.includes("=>")) {
    return /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(text)?.[1]
  }
  if (ruleId === "method-definition") {
    return /^(?:\s*(?:public|private|protected|static|async|abstract|override|readonly|get|set)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/.exec(text)?.[1]
  }
  return undefined
}

export const javascriptSourceLanguageAdapter: SourceLanguageAdapter = {
  id: "javascript-family",
  variants: [
    {
      extensions: [".ts", ".mts", ".cts"],
      astGrepCliLanguage: "ts",
      astGrepRuleLanguage: "TypeScript",
      factsLanguage: "typescript",
    },
    {
      extensions: [".tsx"],
      astGrepCliLanguage: "tsx",
      astGrepRuleLanguage: "Tsx",
      factsLanguage: "tsx",
    },
    {
      extensions: [".js", ".mjs", ".cjs"],
      astGrepCliLanguage: "js",
      astGrepRuleLanguage: "JavaScript",
      factsLanguage: "javascript",
    },
    {
      extensions: [".jsx"],
      astGrepCliLanguage: "jsx",
      astGrepRuleLanguage: "Tsx",
      factsLanguage: "jsx",
    },
  ],
  calls: {
    query: { type: "pattern", value: "$CALLEE($$$ARGS)" },
    syntaxKind: "call_expression",
    extractSymbol: (match) => match.metaVariables?.single?.CALLEE?.text,
  },
  nodes: [
    {
      id: "function-declaration",
      astKind: "function_declaration",
      syntaxKind: "function-declaration",
      focusKind: "declaration",
      scopeKind: "function",
      extractSymbol: declarationSymbol,
    },
    {
      id: "method-definition",
      astKind: "method_definition",
      syntaxKind: "method-definition",
      focusKind: "declaration",
      scopeKind: "method",
      extractSymbol: declarationSymbol,
    },
    {
      id: "arrow-function",
      astKind: "arrow_function",
      syntaxKind: "arrow-function",
      scopeKind: "callback",
    },
    {
      id: "function-expression",
      astKind: "function_expression",
      syntaxKind: "function-expression",
      scopeKind: "function",
      extractSymbol: declarationSymbol,
    },
    {
      id: "variable-declarator",
      astKind: "variable_declarator",
      syntaxKind: "variable-declarator",
      focusKind: "assignment",
      scopeKind: "callback",
      extractSymbol: declarationSymbol,
      includeAsScope: (match) => match.text.includes("=>"),
    },
    {
      id: "return-statement",
      astKind: "return_statement",
      syntaxKind: "return-statement",
      focusKind: "return",
    },
    {
      id: "assignment-expression",
      astKind: "assignment_expression",
      syntaxKind: "assignment-expression",
      focusKind: "assignment",
    },
    {
      id: "if-statement",
      astKind: "if_statement",
      syntaxKind: "if-statement",
      focusKind: "branch",
    },
    {
      id: "switch-statement",
      astKind: "switch_statement",
      syntaxKind: "switch-statement",
      focusKind: "branch",
    },
    {
      id: "for-statement",
      astKind: "for_statement",
      syntaxKind: "for-statement",
      focusKind: "branch",
    },
    {
      id: "for-in-statement",
      astKind: "for_in_statement",
      syntaxKind: "for-in-statement",
      focusKind: "branch",
    },
    {
      id: "while-statement",
      astKind: "while_statement",
      syntaxKind: "while-statement",
      focusKind: "branch",
    },
    {
      id: "do-statement",
      astKind: "do_statement",
      syntaxKind: "do-statement",
      focusKind: "branch",
    },
    {
      id: "ternary-expression",
      astKind: "ternary_expression",
      syntaxKind: "ternary-expression",
      focusKind: "branch",
    },
  ],
}
