Use the subagent tool to launch exactly one scout agent as the Report Director.

The scout agent's job is NOT to solve the codebase or produce a remediation backlog.
The job is to decide how the final visual report should INFORM a reader:
- What is this project?
- What are its main moving parts?
- Which components, flows, boundaries, and concepts should a reader understand first?
- Where should attention go when navigating the codebase?
- What evidence supports that orientation?

Hard framing rules:
- Orientation first. Do not lead with issues, fixes, refactors, or "what to do next".
- "Attention area" means "important place to understand", not "bad code".
- Recommendations, if any, are a short trailing section. They must not drive the artifact structure.
- Prefer: purpose, system map, domain concepts, important components, runtime/data flows, boundaries, verification confidence, attention areas.
- Avoid generic code-quality report shape. Use the packets to choose what this specific project needs explained.
- Do not emit a final VisualArtifactSpec. Do not call create_visual_artifact.

Repository root:
{{repoRoot}}

Read these source instructions and evidence files yourself before writing:

Source instruction files:
{{sourceInstructionFiles}}

Deterministic digest:
- {{digestPathRelative}}

Extractor run manifest:
- {{extractorRunPathRelative}}

Packet JSON files:
{{packetPaths}}

Free-flow agentic reports:
{{reportPaths}}

Supported artifact node types for suggestedNodeTypes:
{{artifactNodeTypes}}

Use these source instructions as the north star:

{{sourceContext}}

Write two files:
1. JSON director brief: {{jsonPath}}
2. Human-readable storyboard: {{markdownPath}}

The JSON must match this exact shape:

{
  "id": "report-direction",
  "thesis": "one concrete sentence about what the report teaches",
  "intendedArtifact": "code-architecture",
  "audience": "who this is for",
  "reportMode": "orientation-first",
  "emphasis": ["short emphasis strings"],
  "sectionOrder": ["section-id-in-display-order"],
  "sections": [
    {
      "id": "stable-kebab-id",
      "title": "Reader-facing section title",
      "purpose": "What this section helps the reader understand, not what it fixes",
      "readerQuestion": "Question answered by this section",
      "sourcePacketIds": ["packet-id"],
      "suggestedNodeTypes": ["heading", "text", "stat-card"],
      "dataKeys": ["optional-data-key"],
      "codeSnippetIds": ["optional-snippet-id"]
    }
  ],
  "risksAndCaveats": ["evidence limitations or uncertainty"],
  "unresolvedQuestions": ["optional concise questions"]
}

Storyboard markdown guidance:
- Start with the thesis.
- Then list the artifact sections in order.
- For each section, explain what the reader learns and which packets support it.
- Keep "what to do next" minimal or absent.
- Use neutral language. No blame, no generic "bad code" framing.
