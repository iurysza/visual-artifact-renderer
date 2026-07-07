---
name: review-handoff-flow
description: Process for reviewing each piece of work and handing off to a fix agent.
---

# Review and handoff flow

After every piece of work, follow this loop.

## 1. Present the work by committing it

Do not generate a standalone report. The commit itself is the report.

- Group changes into one logical commit.
- Use a concise Conventional Commits-style message.
- Include a short body if the change needs context.
- Do not push.

## 2. User reads and annotates the commit

The user reviews the commit message and the diff.

## 3. User reviews the code

The user inspects the actual changed files and logic.

## 4. Use Plannotator

Turn feedback, issues, and next steps into a tracked plan with Plannotator.

## 5. Launch an agent to address the issues

Spin up a new agent to implement the fixes captured in the Plannotator plan.

## 6. Hand off the session

Before the new agent starts:

1. Commit the current work.
2. Hand off the session to the new agent.

## Summary

Commit → user reviews commit/code → Plannotator plan → new agent fixes → commit again → hand off.
