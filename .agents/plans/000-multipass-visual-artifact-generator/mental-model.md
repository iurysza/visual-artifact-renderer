> **Code quality is not “clean-looking code.” It is how safely, cheaply, and confidently the system can be changed.**

That is the shared idea behind _Code Complete_, Fowler’s _Refactoring_, and Feathers’ _Working Effectively with Legacy Code_.

## The core question

When reviewing a codebase, ask:

> **How hard is it to make a correct change here?**

Bad code is not just ugly. Bad code makes every change risky because you cannot easily answer:

- What does this code do?
- Where should this behavior live?
- What else will break if I change it?
- How do I verify that I did not break it?
- Is this complexity essential, or accidental?

That is the whole game.

---

# 1. Understandability

The first quality signal is whether the code explains itself.

Good code lets you build a mental model quickly. Bad code makes you simulate everything in your head.

Look for:

- Clear names
- Small functions
- Obvious control flow
- Few hidden side effects
- Code organized around concepts, not random technical steps
- Comments explaining **why**, not restating **what**

Common terms:

- **Readability**
- **Cognitive load**
- **Self-documenting code**
- **Essential complexity vs accidental complexity**
- **Intention-revealing names**

Bad signs:

```ts
function process(data, flag, mode) { ... }
```

Better:

```ts
function calculateInvoiceTotal(invoice, includeDiscounts) { ... }
```

The second version tells you the domain intention.

Compelling argument:

> Code is read far more often than it is written. Optimizing only for writing speed is usually a tax on every future reader.

---

# 2. Changeability

This is maybe the most important one.

A codebase is healthy when a small requirement leads to a small code change.

Bad sign:

> “To change this one thing, I had to touch 14 files.”

Terms people use:

- **Shotgun surgery** — one change requires edits everywhere.
- **Divergent change** — one class/module changes for many unrelated reasons.
- **Ripple effect** — a local change causes unexpected breakage elsewhere.
- **Change amplification** — small product change creates large code diff.
- **Locality of change** — related logic is near each other.

Look for:

- Are features grouped by behavior/domain?
- Are responsibilities clear?
- Can you change one business rule without touching UI, database, networking, and tests?
- Is there one obvious place where a change belongs?

Good code has **low change amplification**.

---

# 3. Coupling and cohesion

This is one of the most important vocabulary pairs.

## Cohesion

> Do the things inside this module belong together?

High cohesion is good. A class/module should have one strong reason to exist.

Bad sign:

```ts
UserService
  - creates users
  - sends emails
  - formats dates
  - validates payments
  - writes analytics
  - talks to cache
```

That is low cohesion.

## Coupling

> How much does this thing know about other things?

Low coupling is good. A module should not need to know too many details about the rest of the system.

Terms:

- **High cohesion**
- **Low coupling**
- **Separation of concerns**
- **Information hiding**
- **Encapsulation**
- **Dependency inversion**
- **Law of Demeter**
- **Connascence** — when two pieces of code must change together because they share assumptions.

Compelling argument:

> Cohesion makes code easier to understand. Low coupling makes code easier to change.

---

# 4. Testability

Feathers’ big idea:

> Legacy code is code without tests.

Not old code. Not ugly code. **Untested code.**

A high-quality codebase lets you verify behavior quickly.

Look for:

- Can this logic be tested without starting the whole app?
- Are dependencies injectable or hardcoded?
- Are side effects isolated?
- Can you test business rules without the database, network, UI, or clock?
- Are tests checking behavior, not implementation details?

Terms:

- **Unit tests**
- **Integration tests**
- **Characterization tests**
- **Golden master tests**
- **Seams**
- **Test harness**
- **Regression safety**
- **Mocking/stubbing/fakes**
- **Deterministic tests**

Important legacy-code concept:

> A **seam** is a place where you can change behavior without editing the code directly.

Example: if code directly calls the real clock, real database, and real API, it has few seams. That makes it hard to test.

Bad:

```ts
const now = new Date();
const response = await fetch(PRODUCTION_URL);
```

Better:

```ts
function calculateRenewalDate(clock: Clock) { ... }
function loadUser(apiClient: ApiClient) { ... }
```

Now you can test with fake time and fake APIs.

---

# 5. Duplication

Duplication is not only repeated text. It is repeated **knowledge**.

The real issue is:

> If a business rule changes, how many places must be updated?

Terms:

- **DRY** — Don’t Repeat Yourself
- **Knowledge duplication**
- **Single source of truth**
- **Parallel inheritance hierarchies**
- **Copy-paste programming**

But be careful: bad abstraction can be worse than duplication.

Good rule:

> Duplicate code is often cheaper than the wrong abstraction. But duplicated business rules are dangerous.

Related term:

- **AHA** — Avoid Hasty Abstractions
- **YAGNI** — You Aren’t Gonna Need It

---

# 6. Simplicity

From _Code Complete_ especially: complexity is the enemy.

Look for:

- Deep nesting
- Too many branches
- Boolean flags controlling multiple paths
- Huge functions
- Large parameter lists
- Clever one-liners
- Implicit state
- Too many abstractions for simple things

Terms:

- **KISS** — Keep It Simple
- **Cyclomatic complexity**
- **Cognitive complexity**
- **Incidental complexity**
- **Overengineering**
- **Premature abstraction**
- **Premature optimization**

Bad sign:

```ts
if (user && user.flags?.includes("x") && !user.deleted && mode !== "legacy") {
  ...
}
```

Maybe that condition deserves a name:

```ts
if (userCanReceivePromotion(user, mode)) {
  ...
}
```

Compelling argument:

> Complexity compounds. Every extra branch multiplies the number of states the reader has to reason about.

---

# 7. Boundaries

Good systems have strong boundaries.

You want clear separation between:

- Domain logic
- UI
- Database
- Network/API
- Framework code
- Configuration
- External services

Terms:

- **Architecture boundaries**
- **Ports and adapters**
- **Hexagonal architecture**
- **Clean architecture**
- **Layering**
- **Dependency direction**
- **Domain model**
- **Infrastructure**
- **Anti-corruption layer**

A strong codebase keeps business logic away from framework noise.

Bad:

```ts
React component directly validates business rules,
calls API,
formats money,
updates analytics,
handles permissions,
and mutates global state.
```

Better:

```ts
UI → use case/service → domain logic → infrastructure
```

Compelling argument:

> Frameworks change. Business rules survive. Don’t trap your business rules inside framework-specific code.

---

# 8. Naming and domain language

Good code uses the language of the business/domain.

If the product talks about “subscriptions”, “renewals”, “grace periods”, and “invoices”, the code should too.

Terms:

- **Ubiquitous language**
- **Domain-driven design**
- **Intention-revealing names**
- **Conceptual integrity**

Bad:

```ts
ThingManager;
DataProcessor;
ItemHandler;
StatusUtil;
```

These are vague.

Better:

```ts
SubscriptionRenewalPolicy;
InvoiceFinalizer;
PaymentRetryScheduler;
```

Compelling argument:

> If the code does not use the language of the problem, every reader has to translate between product thinking and code thinking.

---

# 9. Code smells

From Fowler: a **code smell** is not necessarily a bug. It is a signal that something may be wrong.

Common smells:

- **Long Method** — function does too much.
- **Large Class / God Object** — class knows too much.
- **Feature Envy** — method cares more about another object’s data than its own.
- **Primitive Obsession** — using strings/numbers instead of meaningful domain types.
- **Shotgun Surgery** — one change touches many places.
- **Divergent Change** — one module changes for unrelated reasons.
- **Data Clumps** — same group of values passed around together.
- **Switch Statements** — repeated branching by type/mode/status.
- **Temporary Field** — field only valid sometimes.
- **Middle Man** — class only delegates without adding value.
- **Inappropriate Intimacy** — modules know too much about each other.
- **Speculative Generality** — abstraction built for imaginary future needs.

Smells are discussion tools. They help you say:

> “This code feels hard to change because it has feature envy and shotgun surgery.”

That is much better than:

> “This code is bad.”

---

# 10. Refactoring mindset

Refactoring means:

> Changing the structure of code without changing its behavior.

The goal is not to make code “pretty.” The goal is to make the next change easier.

Common refactorings:

- **Extract Function**
- **Extract Class**
- **Inline Function**
- **Rename Variable**
- **Move Method**
- **Introduce Parameter Object**
- **Replace Conditional with Polymorphism**
- **Replace Primitive with Value Object**
- **Encapsulate Collection**
- **Separate Query from Modifier**

Very important rule:

> Refactor in small, safe steps.

Especially in legacy code:

1. Add characterization tests.
2. Find seams.
3. Make the smallest safe improvement.
4. Then change behavior.

---

# 11. Attention points in a real codebase

When entering a codebase, I would look at these areas:

## First: where does complexity concentrate?

Look for big files, big classes, big functions, unstable modules, and files everyone is afraid to touch.

Terms:

- **Hotspots**
- **Churn**
- **Technical debt**
- **Complexity concentration**
- **Change-prone modules**

A file that is both complex and frequently changed is a serious risk.

---

## Second: where are the boundaries weak?

Check whether UI, persistence, networking, and business rules are mixed together.

Bad sign:

> “To test this business rule, I need to boot the whole app.”

---

## Third: how safe are changes?

Look at tests, CI, type checks, linters, review habits, deployment process.

Good code quality is not just code. It is the whole feedback system.

Terms:

- **Fast feedback**
- **Regression safety**
- **Continuous integration**
- **Build health**
- **Observability**
- **Deployment confidence**

---

## Fourth: are abstractions helping or hiding?

Good abstractions reduce cognitive load.

Bad abstractions make you jump through 9 files to understand one thing.

Terms:

- **Leaky abstraction**
- **Indirection**
- **Abstraction debt**
- **Overengineering**
- **Wrong abstraction**

A useful test:

> Does this abstraction make the code easier to understand, or merely more “architectural”?

---

## Fifth: where are the side effects?

Side effects include:

- Database writes
- Network calls
- File system writes
- Global state mutation
- Logging/analytics
- Time/randomness
- UI state mutation

Good code isolates side effects.

Bad code mixes calculation and mutation everywhere.

Terms:

- **Pure function**
- **Side effect**
- **Command-query separation**
- **Referential transparency**
- **Immutability**

---

# A simple review checklist

When looking at code, ask:

1. **Can I understand this quickly?**
2. **Can I change it locally?**
3. **Can I test it easily?**
4. **Does each module have one clear responsibility?**
5. **Are dependencies pointing in a sane direction?**
6. **Are business concepts explicit in the code?**
7. **Is duplication hiding repeated knowledge?**
8. **Are abstractions justified by real use cases?**
9. **Are side effects isolated?**
10. **Would I feel safe modifying this under pressure?**

That last one is powerful.

> Good code is code you can change under pressure without fear.

---

# The strongest summary

Software quality is mostly about **managing change**.

The best codebases have:

- **Clarity** — you understand what is happening.
- **Locality** — changes stay contained.
- **Testability** — behavior can be verified.
- **Cohesion** — related things live together.
- **Low coupling** — unrelated things do not depend on each other.
- **Good boundaries** — domain logic is protected.
- **Simple abstractions** — structure helps, not hides.
- **Fast feedback** — mistakes are caught early.

The worst codebases have the opposite:

- You cannot understand behavior locally.
- Every change touches too many places.
- Tests are missing or brittle.
- Business rules are scattered.
- Framework, UI, DB, and domain logic are tangled.
- Abstractions exist, but nobody knows why.
- People rely on fear, manual testing, and tribal knowledge.

That is the mental model. Code quality is not aesthetic. It is **the ability to keep evolving the system without drowning in risk.**
