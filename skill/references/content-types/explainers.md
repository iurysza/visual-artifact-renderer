---
description: "Build visual explainers and lessons with a clear mental model, learner-paced examples, and retrieval feedback."
date created: 2026-07-13
date modified: 2026-07-13
tags: ["visual-artifact", "explainer", "lesson", "teaching"]
---

# Explainers and lessons

Use this pattern when the reader should understand, explain, choose, or do something—not merely inspect a report.

## Define the win first

Before choosing nodes, write four facts:

1. **Audience** — who is learning?
2. **Prior knowledge** — what can you safely assume?
3. **Outcome** — what should they explain or do afterward?
4. **Likely misconception** — what wrong model should the artifact correct?

If the outcome cannot be written as a verb, the explainer is not scoped yet.

## Canonical lesson shape

Build the shortest path that supports the outcome:

1. **Thesis** — one `text` node with `size: "lg"` states the useful model.
2. **Visual anchor** — `annotated-visual`, `mermaid`, `flow`, or `image` makes the model inspectable.
3. **Worked progression** — `visual-sequence` reveals one causal or procedural change at a time.
4. **Retrieval** — `knowledge-check` asks the learner to use the model without copying the preceding sentence.
5. **Recap and next rep** — compact `text`, `definition-list`, or `code-block`; sources may follow in `prose`.

Not every explainer needs every step. Lessons should normally include retrieval. Static technical explainers may stop after the worked progression and recap.

## Lesson-native nodes

### `annotated-visual`

Use for anatomy, screenshots, interfaces, system diagrams, and physical objects.

- `x` and `y` are percentages from the image's top-left corner.
- Use 2–6 markers in normal lessons; the contract allows 12.
- Each marker explains one visible feature and why it matters.
- Match `aspect` to the source image so hotspots stay aligned.
- Do not use decorative markers or repeat the caption in every marker.

### `visual-sequence`

Use when understanding depends on order or change: code execution, a request path, a worked example, a causal mechanism, or a procedure.

- Each frame contains ordinary artifact nodes.
- Put one conceptual change in each frame.
- Keep the same visual frame of reference when possible.
- Use 2–6 frames in normal lessons; the contract allows 12.
- Use `stepper` for static progress. Use `visual-sequence` when the learner should advance through content.

### `knowledge-check`

Use after the learner has encountered the model.

- Provide 2–6 plausible choices with similar length and specificity.
- `answerId` must match one unique choice `id`.
- Use per-choice `feedback` to explain a misconception.
- Use `explanation` to reconnect the answer to the mental model.
- Do not ask for trivia visible verbatim immediately above the check.
- State is local-only and resets on reload. Do not imply scoring or saved progress.

## Recipes

| Explainer | Shape | Primary nodes |
|---|---|---|
| Anatomy | thesis → labeled whole → recap | `annotated-visual`, `definition-list` |
| Concept | thesis → relationship map → prediction | `mermaid` or `flow`, `knowledge-check` |
| Procedure | outcome → worked steps → independent choice | `visual-sequence`, `code-block`, `knowledge-check` |
| Causal mechanism | initial state → changes → effect | `visual-sequence`, `flow`, `knowledge-check` |
| Code/system | boundary model → request trace → code evidence | `mermaid`, `visual-sequence`, `code-block` |
| Comparison | decision question → evidence → choice | `comparison-table`, `knowledge-check` |

## Copyable pattern

```json
{
  "slug": "request-boundaries-lesson",
  "title": "Why the renderer owns the UI",
  "description": "Trace one artifact from agent output to trusted components.",
  "layout": { "type": "default" },
  "nodes": [
    {
      "type": "text",
      "props": {
        "text": "The agent chooses meaning; the renderer owns presentation and behavior.",
        "size": "lg"
      }
    },
    {
      "type": "annotated-visual",
      "props": {
        "src": "request-path.png",
        "alt": "Request path from agent through CLI to renderer",
        "caption": "Each boundary removes a different kind of uncertainty.",
        "aspect": "wide",
        "markers": [
          {
            "title": "Agent contract",
            "description": "The agent emits semantic JSON rather than JSX or CSS.",
            "x": 18,
            "y": 50
          },
          {
            "title": "Renderer adapters",
            "description": "Trusted components own layout, interaction, and accessibility.",
            "x": 82,
            "y": 50
          }
        ]
      }
    },
    {
      "type": "visual-sequence",
      "props": {
        "title": "Follow one node",
        "caption": "Advance only after you can state what each boundary guarantees.",
        "items": [
          {
            "title": "Describe intent",
            "description": "The agent chooses a semantic node.",
            "nodes": [
              {
                "type": "code-block",
                "props": {
                  "language": "json",
                  "code": "{ \"type\": \"text\", \"props\": { \"text\": \"Hello\" } }"
                }
              }
            ]
          },
          {
            "title": "Render safely",
            "description": "The registry maps the node to a trusted adapter.",
            "nodes": [
              {
                "type": "text",
                "props": {
                  "text": "No arbitrary component code crosses the contract boundary."
                }
              }
            ]
          }
        ]
      }
    },
    {
      "type": "knowledge-check",
      "props": {
        "prompt": "Why does the renderer, rather than the agent, own styling?",
        "choices": [
          {
            "id": "smaller-json",
            "label": "It makes every JSON file smaller",
            "feedback": "Smaller output helps, but containment and consistency are the core guarantees."
          },
          {
            "id": "trusted-ui",
            "label": "It keeps presentation inside trusted components"
          }
        ],
        "answerId": "trusted-ui",
        "explanation": "Renderer-owned components enforce the shared visual system, behavior, and accessibility without accepting arbitrary UI code.",
        "hint": "Ask which layer can safely enforce the same behavior across every artifact."
      }
    }
  ]
}
```

## Composition rules

- Keep the primary explanation visible. Use `accordion` only for evidence, proofs, edge cases, or sources.
- Pair words with a relevant visual; do not add a diagram that merely repeats the prose.
- Put explanations beside the visual they describe.
- Prefer a static annotated diagram over animation unless motion itself is the concept.
- Keep prose near 65–75 characters per line and split long narratives into sections.
- Do not pad lessons with KPIs, uniform card grids, or node counts.
- Do not hide the answer through interaction while leaking it through formatting.

## Final check

Before creating the artifact, verify:

- [ ] The first node states a useful model, not metadata.
- [ ] Every visual serves the stated outcome.
- [ ] Marker coordinates match the chosen image aspect.
- [ ] Each sequence frame introduces one change.
- [ ] Choice wording does not reveal the answer.
- [ ] Feedback explains why, not only correct/incorrect.
- [ ] Images have meaningful alt text and captions where needed.
- [ ] Nested lesson nodes stay within the contract resource limits.
- [ ] The learner can now explain, choose, predict, or do the target action.

## Evidence behind the pattern

- Richard Mayer, multimedia, coherence, signaling, and segmenting principles: <https://assets.cambridge.org/052183/8738/excerpt/0521838738_excerpt.htm>
- Dunlosky et al., retrieval practice and distributed practice: <https://gwern.net/doc/psychology/spaced-repetition/2013-dunlosky.pdf>
- W3C cognitive accessibility guidance: <https://www.w3.org/TR/coga-usable/>
