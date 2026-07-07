UX / state context — AI Collaboration (formatter-focused)

> **Note: future / superseded.** This document describes a design direction that was
> not shipped in the current AI-colab implementation. The shipped implementation
> keeps comments in memory only, uses the sparse Markdown annotation format, and
> does not store `aiColab` comments inside the artifact spec. Keep this doc for
> historical reference only; do not treat it as active behavior.

Summary of findings

- Existing persisted annotations use a small, strict shared model (skill/shared/src/annotations.ts): AnnotationAnchor = { nodeId?, nodePath, nodeType, textSnippet?, x?, y? } and AnnotationThread / AnnotationMessage with author {name,email}.
- The renderer already exposes stable DOM anchors via data-va-node-id (from metadata.id) and data-va-node-path (deterministic path). findAnchorElement(nodeId,nodePath) is the canonical lookup used by the UI.
- AnnotationProvider loads annotations.json into AnnotationDocument and optimistically posts AnnotationMutations (createThread/addMessage/resolveThread/reopenThread). The provider and UI expect the AnnotationThread/Message/Anchor shapes above.
- The new AI colab feature requirement: let a formatter (agent) emit in-spec hints/comments that are shown in the UI as ephemeral (memory-only) comments; the user can edit/add and later press a button to "send feedback" which converts them to persisted annotation mutations.

Design principle (formatting contract scope)

Keep anchoring semantics (how we point at UI nodes) identical to the existing AnnotationAnchor shape so the renderer code can reuse findAnchorElement, nodeIdentityMatches, and use-anchor-presence. Do NOT conflate persistence: formatter-emitted comments must be clearly flagged as ephemeral and kept out of annotations.json unless/ until the user explicitly sends them.

Recommendation (single clear approach)

- Reuse AnnotationAnchor for anchors (nodePath required, nodeId optional, nodeType, textSnippet, optional normalized x/y for visual placement).
- Have the formatter include a top-level optional field in the VisualArtifactSpec (requires schema addition in a follow-up implementation):

  spec.aiColab = {
    version?: 1,
    comments?: ColabComment[]
  }

  where ColabComment mirrors a lightweight AnnotationThread but is explicitly ephemeral. This preserves a clear separation: anchors re-use the shared anchor contract; storage semantics remain separate (aiColab lives in the spec, not annotations.json).

Why: reusing anchor shape lets the renderer find DOM nodes without new lookup code; keeping these comments in-spec (and ephemeral) avoids touching persisted annotation storage or requiring server writes until user action.

Formatter contract proposal (ColabComment shape)

- ColabComment
  - id: string (unique within spec, recommended prefix `ai-` or `ai-<uuid>` to avoid collisions with persisted ids)
  - anchor: AnnotationAnchor (must include nodePath; nodeType recommended; textSnippet strongly recommended)
  - origin?: "assistant" | "formatter" | "user" (optional; default "assistant")
  - messages: ColabMessage[] OR body: string
  - createdAt?: string (ISO)
  - updatedAt?: string (ISO)
  - metadata?: { severity?: "suggestion"|"issue"|"info", tags?: string[] }
  - status?: "ephemeral" | "queued" | "sent" (initially "ephemeral")

- ColabMessage
  - id: string
  - author?: { name: string; email?: string } // optional; if absent the UI uses AI Assistant display
  - body: string
  - createdAt?: string

Minimal example (formatter output to spec)

{
  "slug": "report-1",
  "title": "...",
  "nodes": [ ... ],
  "aiColab": {
    "version": 1,
    "comments": [
      {
        "id": "ai-3f6c8a",
        "anchor": {
          "nodePath": "nodes.2.children.0",
          "nodeType": "text",
          "textSnippet": "Summary of results"
        },
        "origin": "assistant",
        "messages": [
          { "id": "ai-msg-1", "author": {"name":"AI Assistant","email":"ai-assistant@example.test"}, "body": "Consider calling out the confidence interval here." }
        ],
        "status": "ephemeral",
        "createdAt": "2026-07-05T12:00:00.000Z"
      }
    ]
  }
}

Renderer / runtime assumptions (how provider should treat aiColab)

- AnnotationProvider (or a companion ColabProvider) will:
  - Parse spec.aiColab.comments on initial load and convert each into an in-memory ColabThread type.
  - Keep ColabThreads separate from the persisted AnnotationDocument (do not include them in doc.threads or annotations.json unless user sends).
  - Expose ColabThreads via context so AnnotationPanel/NodeBoundary can surface them (badging/overlays) when "AI colab mode" is toggled ON.
  - Use the same anchor lookup (findAnchorElement(nodeId,nodePath)) to position overlays and to compute anchor presence/orphaned state.
  - When user edits or replies locally, mutate the in-memory ColabThread (messages appended) without executing postAnnotationMutations.
  - When the user chooses "Send feedback" (single or bulk), convert selected ColabThreads into AnnotationMutations (createThread + initial messages / addMessage for replies) and post to the existing annotations API. On success, mark those threads as sent (or remove them from in-memory list and rely on fresh annotations.json to show them as persisted threads).

Mapping: ColabComment -> createThread mutation
  - New AnnotationThread.id: keep the ColabComment.id (ok to use ai- prefix) or generate a new id before sending. The server accepts any string id.
  - messages -> messages (each must include author with name+email; for user-authored messages the provider should resolve local author; for AI messages use a canonical AI identity).
  - anchor copied verbatim (must be valid per AnnotationAnchorSchema)

Author rules

- All persisted threads/messages must conform to AnnotationAuthorSchema (name + valid email).
- For AI-origin messages, use a documented canonical identity (e.g., {name: "AI Assistant", email: "ai-assistant@example.test"}) so Zod validation passes.
- For user-created ephemeral comments, use LOCAL_ANONYMOUS_AUTHOR immediately and let resolveLocalAuthor update the author on post if necessary.

Anchoring requirements for the formatter

- nodePath: REQUIRED. The renderer’s deterministic nodePath is the most reliable anchor the client can use without additional node IDs.
- nodeId: OPTIONAL but strongly recommended (when spec author can assign stable metadata.id) — renderer prefers nodeId when present.
- nodeType: REQUIRED (helps the UI label anchors when node is orphaned).
- textSnippet: STRONGLY RECOMMENDED for human context and re-anchoring heuristics.
- x/y: OPTIONAL normalized coordinates in [0,1] relative to the node bounds. Use for fine-grained positioning overlay (e.g., inline text suggestion). Provide both x and y when used.
- Avoid relying on DOM-index offsets inside text nodes; use nodePath + textSnippet + x/y for robust placement.

Placeholders vs DOM tokens

- No renderer markup change is strictly required: NodeBoundary already exposes data-va-node-path and id attributes and the renderer’s findAnchorElement will locate the anchor using the AnnotationAnchor shape.
- Optionally: formatters may inject a lightweight attribute on nodes (e.g., data-va-ai-colab-id="ai-3f6c8a") if they also emit custom nodes; this is optional and not required if the anchor contains nodePath/nodeId.

UI expectations (formatter influences)

- There is a separate toggle for "AI colab mode" that is conceptually distinct from persistent "Comments" mode. When AI colab is OFF, aiColab comments are hidden.
- In AI colab mode, ColabThreads are shown in the same panel as annotations but clearly visually marked as "AI suggestions / unsent" (e.g., badge "AI" and state "Pending / Unsaved").
- Users can: edit AI-suggested messages, add replies, delete suggestions, change anchor (re-attach), or press "Send feedback" to persist selected suggestions.
- When sending, the UI should validate anchors (presence/orphaned) and warn the user if an anchor cannot be resolved; allow "send anyway" with original anchor metadata.

Edge cases and recommendations

- Orphaned anchors: if a target node is missing, show an explicit orphan state (same as persisted threads). Offer user an option to re-attach to another node or send anyway.
- Duplicate anchors: if an aiColab comment maps to the same anchor as an existing persisted thread, do NOT automatically merge. Show a UI hint ("Possible duplicate thread") and provide an explicit "Attach to existing thread" action when sending.
- Spec churn: if the artifact is re-generated while user is composing ephemeral comments, try to maintain ColabThread anchors if the new spec contains the same nodePath or nodeId; otherwise mark them orphaned and surface re-attach UI.
- Validation on send: the renderer should run parseAnnotationAnchor / parseAnnotationMessage (shared zod helpers) before creating mutations to catch obvious violations early.
- IDs: formatter should emit stable unique ephemeral ids (ai-uuid). Avoid using numeric-only ids that might collide with server ids. When sending, the client can keep the id or request new server-generated id (both acceptable).
- Security/metadata: do not embed secrets in messages. Keep aiColab content plain text.

Non-goals / follow-ups (next implementation phase)

- This document is a formatter contract design only. Implementation requires:
  1) Extend VisualArtifactSpecSchema to accept an optional aiColab property and export artifact contract.
  2) Add renderer/provider logic to parse spec.aiColab into in-memory ColabThreads and surface them in the UI when AI colab mode is active.
  3) Implement "Send feedback" mapping to AnnotationMutations and posting flow with optimistic UI and error handling (matching existing patterns in AnnotationProvider).

Open questions (short)

- Do you want formatter-emitted AI comments to appear inside the same annotation sidebar (visually merged) or in a dedicated "AI" tab inside the panel? (I recommend same panel with a clear "AI / unsent" state.)
- Preferred top-level property name: `aiColab` vs `colabComments` vs `ai.comments`? (I recommend `aiColab` for clarity.)

End.
