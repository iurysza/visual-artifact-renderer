```
The lens is: what parts of this codebase matter most for future changes, and why? That matches your previous mental model: code quality is about how safely and confidently the system can evolve, not whether the code looks pretty.

A good report would document the important components, but explain their importance through these dimensions:

Lens	Question
Product importance	Does this component implement core business behavior?
Change frequency	Is this area likely to change often?
Blast radius	If this changes, what else might break?
Boundary ownership	Does it separate UI, domain, data, infrastructure, external APIs?
Complexity concentration	Is this where many rules, branches, modes, or edge cases live?
Test/verification path	How do we know changes here are safe?
Domain language	Does this code represent important business concepts?

The key move is to avoid saying:

“This part is bad.”

Instead say:

“This component is central because it coordinates checkout, payment validation, persistence, and external provider calls. Changes here require broad context and careful regression testing.”
```

---

# Codebase Orientation and Changeability Report

## 1. Purpose of the System

Briefly describe what the system does from a product/business perspective.

Example:

This codebase supports [main user/business capability]. Its primary responsibility is to [core outcome], with supporting functionality around [secondary areas].

## 2. Architectural Overview

Describe the main shape of the system.

Include:

- Main applications/modules/packages
- Entry points
- Major layers
- External systems
- Data sources
- Deployment/runtime assumptions

Example:

The system is organized around [features/layers/services]. The main flow starts in [entry point], passes through [application/service layer], and depends on [database/API/message queue/etc.].

## 3. Core Domain Concepts

List the important business concepts represented in the code.

For each concept:

- What it means
- Where it appears in the code
- Why it matters
- What rules depend on it

Example:

### Subscription

A Subscription represents [meaning]. It is central because renewal, billing, cancellation, and customer status all depend on it.

## 4. Important Components

For each important component, document:

### Component: [Name]

**Responsibility**

What this component owns.

**Why it is important**

Explain whether it is important because of business value, change frequency, technical centrality, external integration, or risk.

**Main collaborators**

List the modules/classes/services it depends on.

**Change implications**

Explain what kinds of changes usually touch this component and what needs to be checked when modifying it.

**Verification path**

Explain how changes here are tested or validated.

Example:

This component is an important orchestration point. It connects user input, business rules, persistence, and external service calls. Because several flows pass through it, changes here may have wider impact than changes in more isolated modules.

## 5. Main User / System Flows

Trace the most important flows through the codebase.

For each flow:

- Trigger / entry point
- Main steps
- Components involved
- Data created or changed
- External calls
- Failure cases
- How the flow is tested

Example flows:

- User signup
- Checkout
- Payment retry
- Data import
- Report generation
- Background sync

## 6. Boundaries and Dependency Direction

Describe how responsibilities are separated.

Look at:

- UI vs business logic
- Domain vs infrastructure
- Internal code vs external services
- Pure logic vs side effects
- Framework-specific code vs product rules

Example:

The clearest boundary is between [A] and [B]. The weaker boundary is between [C] and [D], where business rules and infrastructure concerns are mixed. This makes the area important to understand before changing related behavior.

## 7. Changeability Notes

Describe how easy or risky common changes are.

For example:

| Change type               | Main area touched        | Expected complexity | Notes                                    |
| ------------------------- | ------------------------ | ------------------- | ---------------------------------------- |
| Add a new validation rule | Validation/domain module | Low/Medium/High     | Depends on test coverage                 |
| Add a new provider        | Integration layer        | Medium              | Requires config and contract handling    |
| Change checkout behavior  | Checkout orchestration   | High                | Crosses UI, domain, payment, persistence |

## 8. Testing and Feedback

Document how the codebase gives confidence.

Include:

- Unit tests
- Integration tests
- End-to-end tests
- Manual testing requirements
- CI checks
- Linters/type checks
- Observability/logging
- Known gaps

Phrase neutrally:

The strongest test coverage appears around [area]. The areas that require more manual confidence-building are [area], especially because they involve [external dependency/state/time/database/etc.].

## 9. Operational and Runtime Concerns

Document things someone must know to run or change the system safely.

Include:

- Configuration
- Environment variables
- Feature flags
- Database migrations
- External services
- Background jobs
- Queues
- Caching
- Logging/monitoring
- Deployment assumptions

## 10. Strengths, Tradeoffs, and Attention Areas

Avoid framing this as “problems.”

Use three categories:

### Strengths

What the codebase does well.

### Tradeoffs

Places where the current design makes sense but has consequences.

### Attention Areas

Parts that deserve care when changing because they are central, complex, highly coupled, weakly tested, or business-critical.

Example:

The checkout module is not necessarily “bad,” but it is a high-attention area. It combines orchestration, business rules, external calls, and persistence, so changes here require a broader regression strategy.

## 11. Recommendations

Keep recommendations practical and non-judgmental.

Examples:

- Add characterization tests around [flow]
- Document [domain concept]
- Extract [business rule] from [framework/UI/infrastructure layer]
- Add clearer ownership for [component]
- Improve local testability for [module]
- Reduce change amplification around [flow]

## 12. Summary

End with a concise judgement:

This codebase is easiest to change when working within [well-bounded area]. Changes become more complex around [central flow/component] because [reason]. The most important components to understand first are [A], [B], and [C], because they carry the main business rules and have the largest impact on future changes.
