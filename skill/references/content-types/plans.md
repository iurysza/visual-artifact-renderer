# Plans

Use this guide when the user asks for an implementation plan, RFC or design before building something that touches more than a couple of files.

Adapted from Thariq Shihipar's [html-plan](https://github.com/anthropics/claude-plugins-community/tree/main/html-plan) skill, in our own words.

## Shape

A plan is a tree of claims. The reader should be able to skim the claim sentences alone and know what will be built.

| Level | Answers | Good exhibit |
|---|---|---|
| 1 Why / what | What changes for the user or system? | `mockup`, `state-machine` |
| 2 How | Which code moves, in what order? | `call-stack`, `sequence-diagram`, `box-diagram` |
| 3 Where | Which files and lines? | `code-block` (`diff`, `annotations`), `file-tree` (`notes`, `statusStyle: "marks"`) |

Open the page with a one-sentence `text` (size `lg`), then `change-stats` and `quotes` for the size and the reasons, then the `claim-tree`.

## Rules

1. One claim, one sentence, one exhibit. If a claim needs a paragraph, split it.
2. No prose between a claim and its exhibit. If the exhibit needs explaining, choose a better exhibit.
3. A `decision` sits on the claim it changes, after the exhibit. Ask only about forks that change what gets built: 2 to 5 per plan. Mark your pick `suggested`. If an option removes a claim, say so in its `consequence`.
4. Use change marks (`+`, `~`, `-`) in call stacks, sequences, diagrams and trees so the reader sees what is new.
5. Cite real `path:line` locations and check them before writing. Use `call-stack` excerpts for the lines that matter.
6. Use `claim.aux: "scope"` for out-of-scope notes, not a numbered claim.
7. Captions are one sentence.

## Choosing between overlapping nodes

- `call-stack` sketches what calls what. `execution-trace` is for verified API boundaries and types.
- `sequence-diagram` when the plan changes messages; `mermaid` for a generic sequence.
- `box-diagram` for a graph with placement and proposed parts; `flow` for a linear strip.

## Example

`artifacts/visualizer/call-stack-excerpts/artifact.json` in the source repo uses every plan node. See "Copyable pattern: html-plan style plan" and "Terse forms" in `ai-artifacts/docs/nodes.md`.
