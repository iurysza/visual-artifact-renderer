import { validateMermaid, formatValidationReport } from "../src/lib/mermaid-validator";

const cases = [
  {
    name: "valid flowchart",
    input: `flowchart TD
    Start([Start]) --> Stop([Stop])`,
  },
  {
    name: "valid class diagram",
    input: `classDiagram
    class User {
      +UUID id
      +String email
      +placeOrder()
    }
    User "1" --> "0..*" Order : places`,
  },
  {
    name: "valid sequence diagram",
    input: `sequenceDiagram
    autonumber
    actor U
    participant API
    U->>API: GET /users
    API-->>U: 200 OK`,
  },
  {
    name: "incomplete flowchart link",
    input: `flowchart TD
    A -- B`,
  },
  {
    name: "unclosed class brace",
    input: `classDiagram
    class User {
      +String name`,
  },
  {
    name: "unknown diagram type",
    input: `archchart TD
    A --> B`,
  },
  {
    name: "dangling arrow",
    input: `flowchart TD
    A --> B
    B -->`,
  },
  {
    name: "frontmatter not closed",
    input: `---
config:
  theme: dark
flowchart TD
    A --> B`,
  },
];

async function main() {
  for (const c of cases) {
    const result = await validateMermaid(c.input);
    const status = result.valid ? "✅ VALID" : "❌ INVALID";
    console.log(`\n${status} — ${c.name}`);
    console.log(formatValidationReport(result));
  }
}

main();
