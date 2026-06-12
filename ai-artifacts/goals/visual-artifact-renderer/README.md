# Visual artifact renderer goal package

Visualizer is a local web app plus Pi extension for turning AI-generated JSON into polished visual pages: reports, plans, dashboards, docs, and explainers. The LLM chooses from a supported node manifest, embeds data, calls `create_visual_artifact`, and gets a local URL.

The important trick: the LLM never writes React, routes, JSX, imports, or CSS. It emits a constrained artifact spec; the extension validates it, saves it under `~/.pi/artifacts/<project>/<slug>.json`, and the Next renderer maps each node to trusted UI adapters.

Launch:

```bash
/goal ai-artifacts/goals/visual-artifact-renderer/goal.md
```

Files:

- `interview.md` — decisions from the Plannotator interview plus current implementation updates
- `facts.md` — accepted facts and constraints
- `goal.md` — current design and success criteria
- `design.md` — walkthrough narrative
- `plan.md` — phased implementation checklist and completed state
- `dev-log.md` — running log
