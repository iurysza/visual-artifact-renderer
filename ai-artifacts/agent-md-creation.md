We made repository knowledge the system of record
Context management is one of the biggest challenges in making agents effective at large and complex tasks. One of the earliest lessons we learned was simple: give Codex a map, not a 1,000-page instruction manual.

We tried the “one big AGENTS.md⁠(opens in a new window)” approach. It failed in predictable ways:

Context is a scarce resource. A giant instruction file crowds out the task, the code, and the relevant docs—so the agent either misses key constraints or starts optimizing for the wrong ones.
Too much guidance becomes non-guidance. When everything is “important,” nothing is. Agents end up pattern-matching locally instead of navigating intentionally.
It rots instantly. A monolithic manual turns into a graveyard of stale rules. Agents can’t tell what’s still true, humans stop maintaining it, and the file quietly becomes an attractive nuisance.
It’s hard to verify. A single blob doesn’t lend itself to mechanical checks (coverage, freshness, ownership, cross-links), so drift is inevitable.
So instead of treating AGENTS.md as the encyclopedia, we treat it as the table of contents.

The repository’s knowledge base lives in a structured docs/ directory treated as the system of record. A short AGENTS.md (roughly 100 lines) is injected into context and serves primarily as a map, with pointers to deeper sources of truth elsewhere.

Plain Text

1
AGENTS.md
2
ARCHITECTURE.md
3
docs/
4
├── design-docs/
5
│ ├── index.md
6
│ ├── core-beliefs.md
7
│ └── ...
8
├── exec-plans/
9
│ ├── active/
10
│ ├── completed/
11
│ └── tech-debt-tracker.md
12
├── generated/
13
│ └── db-schema.md
14
├── product-specs/
15
│ ├── index.md
16
│ ├── new-user-onboarding.md
17
│ └── ...
18
├── references/
19
│ ├── design-system-reference-llms.txt
20
│ ├── nixpacks-llms.txt
21
│ ├── uv-llms.txt
22
│ └── ...
23
├── DESIGN.md
24
├── FRONTEND.md
25
├── PLANS.md
26
├── PRODUCT_SENSE.md
27
├── QUALITY_SCORE.md
28
├── RELIABILITY.md
29
└── SECURITY.md
In-repository knowledge store layout.

Design documentation is catalogued and indexed, including verification status and a set of core beliefs that define agent-first operating principles. Architecture documentation⁠(opens in a new window) provides a top-level map of domains and package layering. A quality document grades each product domain and architectural layer, tracking gaps over time.

Plans are treated as first-class artifacts. Ephemeral lightweight plans are used for small changes, while complex work is captured in execution plans⁠(opens in a new window) with progress and decision logs that are checked into the repository. Active plans, completed plans, and known technical debt are all versioned and co-located, allowing agents to operate without relying on external context.

This enables progressive disclosure: agents start with a small, stable entry point and are taught where to look next, rather than being overwhelmed up front.

We enforce this mechanically. Dedicated linters and CI jobs validate that the knowledge base is up to date, cross-linked, and structured correctly. A recurring “doc-gardening” agent scans for stale or obsolete documentation that does not reflect the real code behavior and opens fix-up pull requests.

Agent legibility is the goal
As the codebase evolved, Codex’s framework for design decisions needed to evolve, too.

Because the repository is entirely agent-generated, it’s optimized first for Codex’s legibility. In the same way teams aim to improve navigability of their code for new engineering hires, our human engineers’ goal was making it possible for an agent to reason about the full business domain directly from the repository itself.

From the agent’s point of view, anything it can’t access in-context while running effectively doesn’t exist. Knowledge that lives in Google Docs, chat threads, or people’s heads are not accessible to the system. Repository-local, versioned artifacts (e.g., code, markdown, schemas, executable plans) are all it can see.

Enforcing architecture and taste
Documentation alone doesn’t keep a fully agent-generated codebase coherent. By enforcing invariants, not micromanaging implementations, we let agents ship fast without undermining the foundation. For example, we require Codex to parse data shapes at the boundary⁠(opens in a new window), but are not prescriptive on how that happens (the model seems to like Zod, but we didn’t specify that specific library).

Agents are most effective in environments with strict boundaries and predictable structure⁠(opens in a new window), so we built the application around a rigid architectural model. Each business domain is divided into a fixed set of layers, with strictly validated dependency directions and a limited set of permissible edges. These constraints are enforced mechanically via custom linters (Codex-generated, of course!) and structural tests.

The diagram below shows the rule: within each business domain (e.g. App Settings), code can only depend “forward” through a fixed set of layers (Types → Config → Repo → Service → Runtime → UI). Cross-cutting concerns (auth, connectors, telemetry, feature flags) enter through a single explicit interface: Providers. Anything else is disallowed and enforced mechanically.

AI Is Forcing Us To Write Good Code
When Best Practices Are Best
Steve Krenzel
Dec 29, 2025

Header Image

For decades, we’ve all known what “good code” looks like. Thorough tests. Clear documentation. Small, well-scoped modules. Static typing. Dev environments you can spin up without a minor religious ritual.

These things were always optional, and time pressure usually meant optional got cut.

Agents need these optional things though. They aren’t great at making a mess and cleaning it up later. Agents will happily be the Roomba that rolls over dog poop and drags it all over your house.

The only guardrails are the ones you set and enforce. If the agentic context is lacking and the guardrails aren’t sufficient, you’ll find yourself in a world of pain1. But if the guardrails are solid, the LLM can bounce around tirelessly until the only path out is the correct one.

Our six-person team has made a lot of specific and, sometimes, controversial investments to accommodate our agentic coders. Let’s talk about some of the less obvious ones.

100% Percent Code Coverage
Header Image

The most controversial guideline we have is our most valuable: We require 100% code coverage2.

Everyone is skeptical when they hear this until they live with it for a day. It feels like a secret weapon at times.

Coverage, as we use it, isn’t strictly about bug prevention; it’s about guaranteeing the agent has double-checked the behavior of every line of code it wrote.

The usual misinterpretation is that people think we believe 100% coverage means “no bugs”. Or that we’re chasing a metric, and metrics get gamed. Neither of those are the case here.

Why 100%? At 95% coverage, you’re still making decisions about what’s “important enough” to test. At 99.99%, you don’t know if that uncovered line in ./src/foo.ts was there before you started work on the new feature. At 100%, there’s a phase change and all of that ambiguity goes away3. If a line isn’t covered, it’s because of something you actively just did.

The coverage report becomes a simple todo list of tests you still need to write. It’s also one less degree of freedom we have to give to the agent to reason about.

At 100% coverage, the leverage you get from the tests experiences a step-function increase.
When a model adds or changes code, we force it to demonstrate how that line behaves. It can’t stop at “this seems right.” It has to back it up with an executable example.

Other nice benefits: Unreachable code gets deleted. Edge cases are made explicit. And code reviews become easier because you see concrete examples of how every aspect of the system is expected to behave or change.

Namespaces Are One Honking Great Idea. Let’s do more of those.4
Header Image

The main mechanism agentic tools use to navigate your codebase is the filesystem. They list directories, read filenames, search for strings, and pull files into context.

You should treat your directory structure and file naming with the same thoughtfulness you’d treat any other interface.

A file called ./billing/invoices/compute.ts communicates much more than ./utils/helpers.ts, even if the code inside is identical. Help the LLM out and give your files thoughtful organization.

Additionally, prefer many small well-scoped files.

It improves how context gets loaded. Agents often summarize or truncate large files when they pull them into their working set. Small files reduce that risk. If a file is short enough to be loaded in full, the model can keep the entire thing active in context.

In practice, it will speed up the agent’s flow and eliminate a whole class of degraded performance.

Fast, Ephemeral, Concurrent Dev Environments
Header Image

In the old world, you lived in one dev environment. This is where you’d craft your perfect solution, tweak things, run commands, restart servers, and gradually converge on a solution.

With agents, you do something closer to beekeeping, orchestrating across processes without knowing the specifics of what exactly is happening within each of them. So you need to cultivate a good and healthy hive.

Fast
You need your automated guardrails to run quickly, because you need to run them often.

The goal is to keep the agent on a short leash: make a small change, check it, fix it, repeat.

You can run them a few ways: agent hooks, git hooks, or just prompting (i.e. in your AGENTS.md), but no matter how you run them, your quality checks need to be cheap enough that running them constantly is not slowing things down.

In our setup, every npm test creates a brand new database, runs migrations, and executes the full suite.

This only works for us because we’ve made each of those stages exceptionally fast. We run tests with high concurrency, strong isolation, and a caching layer for third-party calls5. We have 10,000+ assertions that finish in about a minute. Without caching, it takes 20-30 minutes, which would add hours if you expected an agent to run tests several times per task.

Ephemeral
Once you get comfortable with agents, you naturally start running many of them. You’ll spin up and tear down many dev environments multiple times a day. That has to all be fully automated or you’ll avoid doing it.

We have a simple workflow here:

new-feature <name>

That command creates a new git worktree, copies in local config that doesn’t live in git (like .env files), installs dependencies, and then starts your agent with a prompt to interview you to write a PRD together. If the feature name is descriptive enough, it may even just ask to get right to work, assuming it can figure out the rest of the context on its own.

The important part isn’t our specific scripts. It’s the latency. If it takes minutes and involves a bunch of tinkering and manual configuration, you won’t do it. If it is one command and takes 1-2 seconds, you’ll do it constantly.

In our case, one command gives you a fresh, working environment almost immediately, with an agent ready to start.

Concurrent
The final piece is being able to run each environment at the same time. Having a bunch of worktrees doesn’t help if you can only have one of them active at a time.

That means anything that could conflict (e.g. ports, database names, caches, background jobs) needs to be configurable (ideally via environment variables) or otherwise allocated in some conflict-free way.

If you use Docker you get some of this for free, but the general requirement is the same: you need a solid isolation story so you can run several fully functioning dev environments on one machine without cross-talk.

End-To-End Types
Header Image

More broadly, automate the enforcement of as many best practices as you can. Remove degrees of freedom from the LLM. If you’re not already using automatic linters and formatters6, start there. Make those as strict as possible and configured to automatically apply fixes whenever the LLM finishes a task or is about to commit7.

But you should also be using a typed language8.

Entire categories of illegal states and transitions can be eliminated. And types shrink the search space of possible actions the model can take, while doubling as source-of-truth documentation describing exactly what kind of data flows through each layer.

TypeScript
We lean on TypeScript pretty heavily. If something can be reasonably represented cleanly in the type system, we do it.

And we push semantic meaning into the type names. The goal is to make “what is this?” and “where does it go?” answerable at a glance.

When you’re working with agents, good semantic names are an amplifier. If the model sees a type like UserId, WorkspaceSlug, or SignedWebhookPayload, it can immediately understand what kind of thing it is dealing with. It can also search for that thing easily.

Generic names like T are fine when you’re writing a small self-contained generic algorithm, but much less helpful when you’re communicating intent inside a real business system.

OpenAPI
On the API side, we use OpenAPI and generate well-typed clients, so the frontend and backend agree on shapes.

Postgres
On the data side, we use Postgres’ type system as best as we can, and add checks and triggers for invariants that don’t fit into simple column types. Postgres doesn’t have a particularly rich type system, but it has enough there to enforce a surprising amount of correctness. If an agent tries to write invalid data, our database will usually complain clearly and loudly. And we use Kysely to generate well-typed TypeScript clients for us.

All of our other 3rd-party clients either give us good types, or we wrap them to give us good types.

Agents are tireless and often brilliant coders, but they’re only as effective as the environment you place them in. Once you realize this, “good code” stops feeling superfluous and starts feeling essential.

Yes, the upfront work feels like a tax, but it’s the same tax we’ve all been dodging for years. So pay it intentionally. Put it on your agentic roadmap, get it funded by eng leadership, and finally ship the codebase you always hoped for.

---

Parse, don’t validate
2019-11-05 ⦿ functional programming, haskell, types
Historically, I’ve struggled to find a concise, simple way to explain what it means to practice type-driven design. Too often, when someone asks me “How did you come up with this approach?” I find I can’t give them a satisfying answer. I know it didn’t just come to me in a vision—I have an iterative design process that doesn’t require plucking the “right” approach out of thin air—yet I haven’t been very successful in communicating that process to others.

However, about a month ago, I was reflecting on Twitter about the differences I experienced parsing JSON in statically- and dynamically-typed languages, and finally, I realized what I was looking for. Now I have a single, snappy slogan that encapsulates what type-driven design means to me, and better yet, it’s only three words long:

Parse, don’t validate.
The essence of type-driven design
Alright, I’ll confess: unless you already know what type-driven design is, my catchy slogan probably doesn’t mean all that much to you. Fortunately, that’s what the remainder of this blog post is for. I’m going to explain precisely what I mean in gory detail—but first, we need to practice a little wishful thinking.

The realm of possibility
One of the wonderful things about static type systems is that they can make it possible, and sometimes even easy, to answer questions like “is it possible to write this function?” For an extreme example, consider the following Haskell type signature:

foo :: Integer -> Void
Is it possible to implement foo? Trivially, the answer is no, as Void is a type that contains no values, so it’s impossible for any function to produce a value of type Void.1 That example is pretty boring, but the question gets much more interesting if we choose a more realistic example:

head :: [a] -> a
This function returns the first element from a list. Is it possible to implement? It certainly doesn’t sound like it does anything very complicated, but if we attempt to implement it, the compiler won’t be satisfied:

head :: [a] -> a
head (x:\_) = x
warning: [-Wincomplete-patterns]
Pattern match(es) are non-exhaustive
In an equation for ‘head’: Patterns not matched: []
This message is helpfully pointing out that our function is partial, which is to say it is not defined for all possible inputs. Specifically, it is not defined when the input is [], the empty list. This makes sense, as it isn’t possible to return the first element of a list if the list is empty—there’s no element to return! So, remarkably, we learn this function isn’t possible to implement, either.

Turning partial functions total
To someone coming from a dynamically-typed background, this might seem perplexing. If we have a list, we might very well want to get the first element in it. And indeed, the operation of “getting the first element of a list” isn’t impossible in Haskell, it just requires a little extra ceremony. There are two different ways to fix the head function, and we’ll start with the simplest one.

Managing expectations
As established, head is partial because there is no element to return if the list is empty: we’ve made a promise we cannot possibly fulfill. Fortunately, there’s an easy solution to that dilemma: we can weaken our promise. Since we cannot guarantee the caller an element of the list, we’ll have to practice a little expectation management: we’ll do our best return an element if we can, but we reserve the right to return nothing at all. In Haskell, we express this possibility using the Maybe type:

head :: [a] -> Maybe a
This buys us the freedom we need to implement head—it allows us to return Nothing when we discover we can’t produce a value of type a after all:

head :: [a] -> Maybe a
head (x:\_) = Just x
head [] = Nothing
Problem solved, right? For the moment, yes… but this solution has a hidden cost.

Returning Maybe is undoubtably convenient when we’re implementing head. However, it becomes significantly less convenient when we want to actually use it! Since head always has the potential to return Nothing, the burden falls upon its callers to handle that possibility, and sometimes that passing of the buck can be incredibly frustrating. To see why, consider the following code:

getConfigurationDirectories :: IO [FilePath]
getConfigurationDirectories = do
configDirsString <- getEnv "CONFIG_DIRS"
let configDirsList = split ',' configDirsString
when (null configDirsList) $
throwIO $ userError "CONFIG_DIRS cannot be empty"
pure configDirsList

main :: IO ()
main = do
configDirs <- getConfigurationDirectories
case head configDirs of
Just cacheDir -> initializeCache cacheDir
Nothing -> error "should never happen; already checked configDirs is non-empty"
When getConfigurationDirectories retrieves a list of file paths from the environment, it proactively checks that the list is non-empty. However, when we use head in main to get the first element of the list, the Maybe FilePath result still requires us to handle a Nothing case that we know will never happen! This is terribly bad for several reasons:

First, it’s just annoying. We already checked that the list is non-empty, why do we have to clutter our code with another redundant check?

Second, it has a potential performance cost. Although the cost of the redundant check is trivial in this particular example, one could imagine a more complex scenario where the redundant checks could add up, such as if they were happening in a tight loop.

Finally, and worst of all, this code is a bug waiting to happen! What if getConfigurationDirectories were modified to stop checking that the list is empty, intentionally or unintentionally? The programmer might not remember to update main, and suddenly the “impossible” error becomes not only possible, but probable.

The need for this redundant check has essentially forced us to punch a hole in our type system. If we could statically prove the Nothing case impossible, then a modification to getConfigurationDirectories that stopped checking if the list was empty would invalidate the proof and trigger a compile-time failure. However, as-written, we’re forced to rely on a test suite or manual inspection to catch the bug.

Paying it forward
Clearly, our modified version of head leaves some things to be desired. Somehow, we’d like it to be smarter: if we already checked that the list was non-empty, head should unconditionally return the first element without forcing us to handle the case we know is impossible. How can we do that?

Let’s look at the original (partial) type signature for head again:

head :: [a] -> a
The previous section illustrated that we can turn that partial type signature into a total one by weakening the promise made in the return type. However, since we don’t want to do that, there’s only one thing left that can be changed: the argument type (in this case, [a]). Instead of weakening the return type, we can strengthen the argument type, eliminating the possibility of head ever being called on an empty list in the first place.

To do this, we need a type that represents non-empty lists. Fortunately, the existing NonEmpty type from Data.List.NonEmpty is exactly that. It has the following definition:

data NonEmpty a = a :| [a]
Note that NonEmpty a is really just a tuple of an a and an ordinary, possibly-empty [a]. This conveniently models a non-empty list by storing the first element of the list separately from the list’s tail: even if the [a] component is [], the a component must always be present. This makes head completely trivial to implement:2

head :: NonEmpty a -> a
head (x:|\_) = x
Unlike before, GHC accepts this definition without complaint—this definition is total, not partial. We can update our program to use the new implementation:

getConfigurationDirectories :: IO (NonEmpty FilePath)
getConfigurationDirectories = do
configDirsString <- getEnv "CONFIG_DIRS"
let configDirsList = split ',' configDirsString
case nonEmpty configDirsList of
Just nonEmptyConfigDirsList -> pure nonEmptyConfigDirsList
Nothing -> throwIO $ userError "CONFIG_DIRS cannot be empty"

main :: IO ()
main = do
configDirs <- getConfigurationDirectories
initializeCache (head configDirs)
Note that the redundant check in main is now completely gone! Instead, we perform the check exactly once, in getConfigurationDirectories. It constructs a NonEmpty a from a [a] using the nonEmpty function from Data.List.NonEmpty, which has the following type:

nonEmpty :: [a] -> Maybe (NonEmpty a)
The Maybe is still there, but this time, we handle the Nothing case very early in our program: right in the same place we were already doing the input validation. Once that check has passed, we now have a NonEmpty FilePath value, which preserves (in the type system!) the knowledge that the list really is non-empty. Put another way, you can think of a value of type NonEmpty a as being like a value of type [a], plus a proof that the list is non-empty.

By strengthening the type of the argument to head instead of weakening the type of its result, we’ve completely eliminated all the problems from the previous section:

The code has no redundant checks, so there can’t be any performance overhead.

Furthermore, if getConfigurationDirectories changes to stop checking that the list is non-empty, its return type must change, too. Consequently, main will fail to typecheck, alerting us to the problem before we even run the program!

What’s more, it’s trivial to recover the old behavior of head from the new one by composing head with nonEmpty:

head' :: [a] -> Maybe a
head' = fmap head . nonEmpty
Note that the inverse is not true: there is no way to obtain the new version of head from the old one. All in all, the second approach is superior on all axes.

The power of parsing
You may be wondering what the above example has to do with the title of this blog post. After all, we only examined two different ways to validate that a list was non-empty—no parsing in sight. That interpretation isn’t wrong, but I’d like to propose another perspective: in my mind, the difference between validation and parsing lies almost entirely in how information is preserved. Consider the following pair of functions:

validateNonEmpty :: [a] -> IO ()
validateNonEmpty (_:_) = pure ()
validateNonEmpty [] = throwIO $ userError "list cannot be empty"

parseNonEmpty :: [a] -> IO (NonEmpty a)
parseNonEmpty (x:xs) = pure (x:|xs)
parseNonEmpty [] = throwIO $ userError "list cannot be empty"
These two functions are nearly identical: they check if the provided list is empty, and if it is, they abort the program with an error message. The difference lies entirely in the return type: validateNonEmpty always returns (), the type that contains no information, but parseNonEmpty returns NonEmpty a, a refinement of the input type that preserves the knowledge gained in the type system. Both of these functions check the same thing, but parseNonEmpty gives the caller access to the information it learned, while validateNonEmpty just throws it away.

These two functions elegantly illustrate two different perspectives on the role of a static type system: validateNonEmpty obeys the typechecker well enough, but only parseNonEmpty takes full advantage of it. If you see why parseNonEmpty is preferable, you understand what I mean by the mantra “parse, don’t validate.” Still, perhaps you are skeptical of parseNonEmpty’s name. Is it really parsing anything, or is it merely validating its input and returning a result? While the precise definition of what it means to parse or validate something is debatable, I believe parseNonEmpty is a bona-fide parser (albeit a particularly simple one).

Consider: what is a parser? Really, a parser is just a function that consumes less-structured input and produces more-structured output. By its very nature, a parser is a partial function—some values in the domain do not correspond to any value in the range—so all parsers must have some notion of failure. Often, the input to a parser is text, but this is by no means a requirement, and parseNonEmpty is a perfectly cromulent parser: it parses lists into non-empty lists, signaling failure by terminating the program with an error message.

Under this flexible definition, parsers are an incredibly powerful tool: they allow discharging checks on input up-front, right on the boundary between a program and the outside world, and once those checks have been performed, they never need to be checked again! Haskellers are well-aware of this power, and they use many different types of parsers on a regular basis:

The aeson library provides a Parser type that can be used to parse JSON data into domain types.

Likewise, optparse-applicative provides a set of parser combinators for parsing command-line arguments.

Database libraries like persistent and postgresql-simple have a mechanism for parsing values held in an external data store.

The servant ecosystem is built around parsing Haskell datatypes from path components, query parameters, HTTP headers, and more.

The common theme between all these libraries is that they sit on the boundary between your Haskell application and the external world. That world doesn’t speak in product and sum types, but in streams of bytes, so there’s no getting around a need to do some parsing. Doing that parsing up front, before acting on the data, can go a long way toward avoiding many classes of bugs, some of which might even be security vulnerabilities.

One drawback to this approach of parsing everything up front is that it sometimes requires values be parsed long before they are actually used. In a dynamically-typed language, this can make keeping the parsing and processing logic in sync a little tricky without extensive test coverage, much of which can be laborious to maintain. However, with a static type system, the problem becomes marvelously simple, as demonstrated by the NonEmpty example above: if the parsing and processing logic go out of sync, the program will fail to even compile.

The danger of validation
Hopefully, by this point, you are at least somewhat sold on the idea that parsing is preferable to validation, but you may have lingering doubts. Is validation really so bad if the type system is going to force you to do the necessary checks eventually anyway? Maybe the error reporting will be a little bit worse, but a bit of redundant checking can’t hurt, right?

Unfortunately, it isn’t so simple. Ad-hoc validation leads to a phenomenon that the language-theoretic security field calls shotgun parsing. In the 2016 paper, The Seven Turrets of Babel: A Taxonomy of LangSec Errors and How to Expunge Them, its authors provide the following definition:

Shotgun parsing is a programming antipattern whereby parsing and input-validating code is mixed with and spread across processing code—throwing a cloud of checks at the input, and hoping, without any systematic justification, that one or another would catch all the “bad” cases.

They go on to explain the problems inherent to such validation techniques:

Shotgun parsing necessarily deprives the program of the ability to reject invalid input instead of processing it. Late-discovered errors in an input stream will result in some portion of invalid input having been processed, with the consequence that program state is difficult to accurately predict.

In other words, a program that does not parse all of its input up front runs the risk of acting upon a valid portion of the input, discovering a different portion is invalid, and suddenly needing to roll back whatever modifications it already executed in order to maintain consistency. Sometimes this is possible—such as rolling back a transaction in an RDBMS—but in general it may not be.

It may not be immediately apparent what shotgun parsing has to do with validation—after all, if you do all your validation up front, you mitigate the risk of shotgun parsing. The problem is that validation-based approaches make it extremely difficult or impossible to determine if everything was actually validated up front or if some of those so-called “impossible” cases might actually happen. The entire program must assume that raising an exception anywhere is not only possible, it’s regularly necessary.

Parsing avoids this problem by stratifying the program into two phases—parsing and execution—where failure due to invalid input can only happen in the first phase. The set of remaining failure modes during execution is minimal by comparison, and they can be handled with the tender care they require.

Parsing, not validating, in practice
So far, this blog post has been something of a sales pitch. “You, dear reader, ought to be parsing!” it says, and if I’ve done my job properly, at least some of you are sold. However, even if you understand the “what” and the “why,” you might not feel especially confident about the “how.”

My advice: focus on the datatypes.

Suppose you are writing a function that accepts a list of tuples representing key-value pairs, and you suddenly realize you aren’t sure what to do if the list has duplicate keys. One solution would be to write a function that asserts there aren’t any duplicates in the list:

checkNoDuplicateKeys :: (MonadError AppError m, Eq k) => [(k, v)] -> m ()
However, this check is fragile: it’s extremely easy to forget. Because its return value is unused, it can always be omitted, and the code that needs it would still typecheck. A better solution is to choose a data structure that disallows duplicate keys by construction, such as a Map. Adjust your function’s type signature to accept a Map instead of a list of tuples, and implement it as you normally would.

Once you’ve done that, the call site of your new function will likely fail to typecheck, since it is still being passed a list of tuples. If the caller was given the value via one of its arguments, or if it received it from the result of some other function, you can continue updating the type from list to Map, all the way up the call chain. Eventually, you will either reach the location the value is created, or you’ll find a place where duplicates actually ought to be allowed. At that point, you can insert a call to a modified version of checkNoDuplicateKeys:

checkNoDuplicateKeys :: (MonadError AppError m, Eq k) => [(k, v)] -> m (Map k v)
Now the check cannot be omitted, since its result is actually necessary for the program to proceed!

This hypothetical scenario highlights two simple ideas:

Use a data structure that makes illegal states unrepresentable. Model your data using the most precise data structure you reasonably can. If ruling out a particular possibility is too hard using the encoding you are currently using, consider alternate encodings that can express the property you care about more easily. Don’t be afraid to refactor.

Push the burden of proof upward as far as possible, but no further. Get your data into the most precise representation you need as quickly as you can. Ideally, this should happen at the boundary of your system, before any of the data is acted upon.3

If one particular code branch eventually requires a more precise representation of a piece of data, parse the data into the more precise representation as soon as the branch is selected. Use sum types judiciously to allow your datatypes to reflect and adapt to control flow.

In other words, write functions on the data representation you wish you had, not the data representation you are given. The design process then becomes an exercise in bridging the gap, often by working from both ends until they meet somewhere in the middle. Don’t be afraid to iteratively adjust parts of the design as you go, since you may learn something new during the refactoring process!

Here are a handful of additional points of advice, arranged in no particular order:

Let your datatypes inform your code, don’t let your code control your datatypes. Avoid the temptation to just stick a Bool in a record somewhere because it’s needed by the function you’re currently writing. Don’t be afraid to refactor code to use the right data representation—the type system will ensure you’ve covered all the places that need changing, and it will likely save you a headache later.

Treat functions that return m () with deep suspicion. Sometimes these are genuinely necessary, as they may perform an imperative effect with no meaningful result, but if the primary purpose of that effect is raising an error, it’s likely there’s a better way.

Don’t be afraid to parse data in multiple passes. Avoiding shotgun parsing just means you shouldn’t act on the input data before it’s fully parsed, not that you can’t use some of the input data to decide how to parse other input data. Plenty of useful parsers are context-sensitive.

Avoid denormalized representations of data, especially if it’s mutable. Duplicating the same data in multiple places introduces a trivially representable illegal state: the places getting out of sync. Strive for a single source of truth.

Keep denormalized representations of data behind abstraction boundaries. If denormalization is absolutely necessary, use encapsulation to ensure a small, trusted module holds sole responsibility for keeping the representations in sync.

Use abstract datatypes to make validators “look like” parsers. Sometimes, making an illegal state truly unrepresentable is just plain impractical given the tools Haskell provides, such as ensuring an integer is in a particular range. In that case, use an abstract newtype with a smart constructor to “fake” a parser from a validator.

As always, use your best judgement. It probably isn’t worth breaking out singletons and refactoring your entire application just to get rid of a single error "impossible" call somewhere—just make sure to treat those situations like the radioactive substance they are, and handle them with the appropriate care. If all else fails, at least leave a comment to document the invariant for whoever needs to modify the code next.

Recap, reflection, and related reading
That’s all, really. Hopefully this blog post proves that taking advantage of the Haskell type system doesn’t require a PhD, and it doesn’t even require using the latest and greatest of GHC’s shiny new language extensions—though they can certainly sometimes help! Sometimes the biggest obstacle to using Haskell to its fullest is simply being aware what options are available, and unfortunately, one downside of Haskell’s small community is a relative dearth of resources that document design patterns and techniques that have become tribal knowledge.

None of the ideas in this blog post are new. In fact, the core idea—“write total functions”—is conceptually quite simple. Despite that, I find it remarkably challenging to communicate actionable, practicable details about the way I write Haskell code. It’s easy to spend lots of time talking about abstract concepts—many of which are quite valuable!—without communicating anything useful about process. My hope is that this is a small step in that direction.

Sadly, I don’t know very many other resources on this particular topic, but I do know of one: I never hesitate to recommend Matt Parson’s fantastic blog post Type Safety Back and Forth. If you want another accessible perspective on these ideas, including another worked example, I’d highly encourage giving it a read. For a significantly more advanced take on many of these ideas, I can also recommend Matt Noonan’s 2018 paper Ghosts of Departed Proofs, which outlines a handful of techniques for capturing more complex invariants in the type system than I have described here.

As a closing note, I want to say that doing the kind of refactoring described in this blog post is not always easy. The examples I’ve given are simple, but real life is often much less straightforward. Even for those experienced in type-driven design, it can be genuinely difficult to capture certain invariants in the type system, so do not consider it a personal failing if you cannot solve something the way you’d like! Consider the principles in this blog post ideals to strive for, not strict requirements to meet. All that matters is to try.

---

/var/folders/gz/ls5qpjvn75nds65z3j_2brjh0000gn/T/pi-clipboard-c8909d3a-1961-4250-b42a-590a43f30833.png
