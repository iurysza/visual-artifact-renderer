"use client"



import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  BalancedQuiz,
  LearningRecordTimeline,
  LessonFrame,
  MissionCompass,
  RecallTrainer,
  TeachingWorkspaceDashboard,
} from "@/components/teaching"

const mission = {
  why: "Understand async JavaScript execution well enough to debug race conditions without guessing.",
  successLooksLike: [
    "Trace promise timing on paper",
    "Predict microtask vs timer order",
    "Explain await yield semantics",
  ],
  constraints: ["15 min/day", "no video courses", "practice in real codebases"],
  outOfScope: [
    "Node.js event loop internals",
    "worker threads",
    "advanced concurrency patterns",
  ],
}

const nextLesson = {
  number: 4,
  title: "Timers vs promises",
  description:
    "Interleave setTimeout and promise chains to see which queue wins.",
  href: "#lesson",
}

const dueReps = [
  {
    concept: "Call stack",
    due: "Now",
    strength: "weak" as const,
    task: "Predict output order",
  },
  {
    concept: "Microtask queue",
    due: "Tomorrow",
    strength: "medium" as const,
    task: "Explain .then timing",
  },
  {
    concept: "Async function yield",
    due: "3 days",
    strength: "fresh" as const,
    task: "Fix a bad mental model",
  },
]

const references = [
  {
    title: "MDN: Promises",
    href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise",
    description: "Authoritative reference for promise methods and semantics.",
  },
  {
    title: "Jake Archibald: Tasks, microtasks, queues",
    href: "https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/",
    description: "The canonical article on event loop ordering.",
  },
]

const records = [
  {
    number: 1,
    slug: "event-loop-basics",
    title: "Event loop basics",
    summary:
      "The call stack runs synchronously; promises schedule continuations in the microtask queue.",
    evidence: "Correctly traced three examples on paper.",
    implication: "Can now introduce await without confusing it with blocking.",
  },
  {
    number: 2,
    slug: "promise-then-timing",
    title: "Promise .then timing",
    summary:
      ".then callbacks run after the current synchronous stack drains, not immediately.",
    evidence: "Answered a balanced quiz correctly on the first try.",
    misconceptionCorrected: "Believed .then ran as soon as the promise resolved.",
    implication: "Ready to practice async/await traces.",
  },
  {
    number: 3,
    slug: "await-yield",
    title: "await yields the async function",
    summary: "await pauses only the current async function, not the whole runtime.",
    evidence: "Explained the distinction in one sentence.",
    implication: "Ready to practice interleaving timers and promises.",
  },
]

const quizQuestion = "When an async function hits await, what pauses?"
const quizOptions = [
  {
    value: "stack",
    label: "The whole JavaScript runtime pauses until the promise resolves.",
  },
  {
    value: "function",
    label: "Only the current async function yields; the call stack keeps draining.",
  },
  {
    value: "timer",
    label: "The callback waits for the next timer tick before it can run.",
  },
]
const quizCorrect = "function"
const quizExplanation =
  "await yields only the current async function. The synchronous call stack keeps running, then the continuation returns through the microtask queue."

const recallPrompt =
  "Trace this output order without running it: console.log('A'); Promise.resolve().then(() => console.log('B')); console.log('C');"
const recallAnswer = "A, C, B. The synchronous logs run first, then the microtask queue drains."
const recallHints = [
  "Which code runs while the stack is still active?",
  "Promises queue in the microtask queue, which runs after the stack.",
]
const recallNextRep =
  "Interleave a setTimeout and predict which runs first."

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
      <Separator className="my-10" />
    </section>
  )
}

export default function TeachingPage() {
  return (
    <div className="mx-auto min-w-0 w-full max-w-5xl p-6 sm:p-8 lg:p-10">
      <header className="mb-10 flex flex-col gap-4">
        <Badge variant="outline" className="w-fit">
          Teaching components
        </Badge>
        <div className="flex max-w-3xl flex-col gap-3">
          <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground">
            /teach workspace components
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Hand-built components for Matt Pocock&apos;s /teach skill: mission,
            lesson frame, balanced quiz, recall trainer, and learning records.
          </p>
        </div>
      </header>

      <Section
        id="dashboard"
        title="Workspace dashboard"
        description="Course home: mission, next lesson, due reps, references, and recent records."
      >
        <TeachingWorkspaceDashboard
          mission={mission}
          nextLesson={nextLesson}
          progress={45}
          dueReps={dueReps}
          references={references}
          recentRecords={records}
        />
      </Section>

      <Section
        id="mission"
        title="Mission compass"
        description="Ground every lesson in the learner's mission."
      >
        <MissionCompass {...mission} />
      </Section>

      <Section
        id="lesson"
        title="Lesson frame"
        description="Self-contained lesson with source link, content, and navigation."
      >
        <LessonFrame
          number={3}
          total={8}
          title="await does not stop the world"
          description="Predict output order before running the code."
          source={{
            label: "Jake Archibald: Tasks, microtasks, queues",
            href: "https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/",
          }}
          prevHref="#"
          nextHref="#"
          nextRep="Trace a timer-vs-promise example"
        >
          <div className="flex flex-col gap-6">
            <BalancedQuiz
              question={quizQuestion}
              options={quizOptions}
              correctValue={quizCorrect}
              explanation={quizExplanation}
              onComplete={(correct) =>
                console.log("quiz complete:", correct)
              }
            />
            <Separator />
            <RecallTrainer
              prompt={recallPrompt}
              answer={recallAnswer}
              hints={recallHints}
              nextRep={recallNextRep}
            />
          </div>
        </LessonFrame>
      </Section>

      <Section
        id="records"
        title="Learning records"
        description="Durable evidence of what the learner has demonstrated."
      >
        <LearningRecordTimeline records={records} />
      </Section>
    </div>
  )
}
