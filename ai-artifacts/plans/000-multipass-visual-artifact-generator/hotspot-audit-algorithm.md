```

The report should answer:

> **Where is change risky, expensive, or hard to understand?**

That matches the mental model from your notes: code quality is mostly about how safely and cheaply the system can be changed.
```

---

# 1. Hotspot algorithm

Use this to find the most important files.

**Instruction:**

1. Find files that changed the most in Git history.
2. Cross-check them with file size / complexity.
3. Mark files that are both:
   - frequently changed
   - large or complicated

**What to look for:**

```bash
git log --name-only --pretty=format: | sort | uniq -c | sort -nr | head -30
```

Then inspect the top files.

**Attention point:**

> “This file is a hotspot: it changes often and contains too much behavior.”

**Why it matters:**

Frequent change + high complexity = high future risk.

---

# 2. Change-scenario tracing

Use this to test **locality of change**.

**Instruction:**

Pick 3 realistic product changes, for example:

- Add a new payment method
- Add a new user status
- Change validation rules
- Add a new screen state
- Change pricing/discount logic

For each change, ask:

1. Where would I start?
2. How many files would I touch?
3. Is there one obvious place for the change?
4. Would UI, API, DB, and business rules all need edits?
5. Are there tests protecting this?

**Attention point:**

> “A small business change requires edits across many unrelated areas.”

This is **shotgun surgery** / **change amplification**.

---

# 3. Boundary inspection

Use this to find architecture problems.

**Instruction:**

Choose important flows and trace them end-to-end:

```text
UI → state/controller → use case/service → domain logic → API/database
```

Look for business logic in the wrong place.

**Bad signs:**

- React/UI component contains business rules
- API models are used directly everywhere
- database entities leak into UI
- validation duplicated in frontend/backend/service
- framework-specific code owns domain behavior

**Attention point:**

> “Business rules are mixed with framework/UI/infrastructure code.”

**Why it matters:**

It makes the system harder to test, reuse, and change.

---

# 4. God object / god module search

Use this to find low cohesion.

**Instruction:**

Look for files/classes/services with names like:

```text
Manager
Service
Helper
Utils
Controller
Handler
Processor
Repository
```

Then ask:

1. Does this module have one clear responsibility?
2. Does it do many unrelated things?
3. Does it know about UI, network, database, analytics, permissions, formatting?
4. Would different teams/features need to edit it for unrelated reasons?

**Attention point:**

> “This module has low cohesion. It centralizes unrelated responsibilities.”

Example:

```text
UserService
- creates users
- validates payments
- sends emails
- formats dates
- logs analytics
- updates cache
```

That is a report-worthy finding.

---

# 5. Dependency direction check

Use this to find coupling problems.

**Instruction:**

Draw or list dependencies between major modules.

Ask:

1. Which modules depend on which?
2. Do low-level details depend on high-level policy, or the opposite?
3. Can domain logic run without UI/database/network?
4. Are there circular dependencies?
5. Do modules import things they should not know about?

**Bad signs:**

```text
domain → React
domain → database framework
domain → HTTP client
feature A → feature B internals
```

**Attention point:**

> “Dependency direction is inverted: core business logic depends on infrastructure details.”

---

# 6. Testability probe

Use this to find legacy-risk areas.

**Instruction:**

Pick important business rules and try to answer:

1. Can I test this without booting the full app?
2. Can I test it without real network/database/time?
3. Are dependencies injectable?
4. Are there seams?
5. Are tests verifying behavior or implementation details?

**Bad signs:**

```ts
const now = new Date()
await fetch(PRODUCTION_URL)
database.save(...)
```

inside core logic.

**Attention point:**

> “This logic is hard to test because side effects are hardcoded.”

This is one of the strongest attention points.

---

# 7. Duplication of knowledge search

Use this to find repeated business rules.

**Instruction:**

Search for repeated conditionals, constants, status names, validation rules, and calculations.

Look for things like:

```text
"isPremium"
"ACTIVE"
"DISABLED"
"discount"
"gracePeriod"
"canEdit"
"canDelete"
"price"
"role ==="
"status ==="
```

Ask:

1. Is the same rule implemented in multiple places?
2. If the rule changes, how many places must change?
3. Are frontend/backend/service rules drifting apart?

**Attention point:**

> “The same business rule exists in multiple places, creating inconsistency risk.”

Important nuance:

Duplication of code is sometimes okay.
Duplication of **business knowledge** is dangerous.

---

# 8. Complex conditional search

Use this to find hidden domain concepts.

**Instruction:**

Search for large `if`, `switch`, `when`, `case`, boolean flags, and mode parameters.

Bad signs:

```ts
if (user.active && !user.deleted && user.role !== "guest" && mode !== "legacy") {
  ...
}
```

or:

```ts
function processOrder(order, isRetry, skipValidation, legacyMode) {
  ...
}
```

Ask:

1. Is this condition repeated?
2. Does it represent a real domain concept?
3. Should it have a name?
4. Is branching by type/status scattered everywhere?

**Attention point:**

> “Important domain rules are hidden inside complex conditionals instead of named concepts.”

Better:

```ts
if (userCanReceivePromotion(user, mode)) {
  ...
}
```

---

# 9. Side-effect mapping

Use this to find risky logic.

**Instruction:**

For important flows, mark every side effect:

- database write
- API call
- file write
- analytics event
- logging
- global state mutation
- time/randomness
- cache mutation
- UI state change

Then ask:

1. Are calculations mixed with side effects?
2. Can the pure logic be tested separately?
3. Are side effects centralized or scattered?
4. Are failures handled clearly?

**Attention point:**

> “Pure business decisions are mixed with side effects, making behavior hard to test and reason about.”

---

# 10. Abstraction usefulness test

Use this to find overengineering.

**Instruction:**

Pick abstractions/interfaces/factories/layers and ask:

1. Does this abstraction hide useful complexity?
2. Does it have multiple real implementations?
3. Does it make the code easier to understand?
4. Or does it force the reader to jump through many files?
5. Is it solving a current problem or an imaginary future one?

**Attention point:**

> “This abstraction adds indirection without reducing complexity.”

Terms:

- speculative generality
- wrong abstraction
- abstraction debt
- leaky abstraction
- unnecessary indirection

---

# 11. Report scoring model

For every attention point, score it like this:

```text
Attention point:
Evidence:
Why it matters:
Change risk:
Test coverage:
Suggested next step:
Confidence:
```

Example:

```text
Attention point:
CheckoutService is a hotspot and god module.

Evidence:
It changed 42 times in the last 6 months, has 1,200 lines, handles validation,
payment retries, analytics, API calls, and UI-facing error formatting.

Why it matters:
Several unrelated product changes require touching this file.

Change risk:
High.

Test coverage:
Partial integration tests only; little isolated unit coverage.

Suggested next step:
Extract payment retry policy and validation rules behind characterization tests.

Confidence:
High.
```

---

# The best “algorithm” overall

Give them this sequence:

```text
1. Find hotspots from Git history.
2. Pick the top 5 changed/complex files.
3. Trace 3 real product change scenarios.
4. Map boundaries and dependency direction.
5. Check testability of important business rules.
6. Search for duplicated business knowledge.
7. Identify god modules and scattered side effects.
8. Rank findings by risk, not ugliness.
9. Write each finding with evidence and suggested next step.
```

The key instruction is:

> **Do not report “this code is bad.” Report where future change is risky, why, and what evidence shows it.**
