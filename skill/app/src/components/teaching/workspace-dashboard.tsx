import { ArrowRight, BookOpen, Target } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  DueRep,
  LearningRecord,
  MissionModel,
  ReferenceDoc,
} from "./types"

export interface TeachingWorkspaceDashboardProps {
  mission: MissionModel
  nextLesson: {
    number: number
    title: string
    description: string
    href?: string
  }
  progress: number
  dueReps: DueRep[]
  references: ReferenceDoc[]
  recentRecords: LearningRecord[]
}

export function TeachingWorkspaceDashboard({
  mission,
  nextLesson,
  progress,
  dueReps,
  references,
  recentRecords,
}: TeachingWorkspaceDashboardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5" />
            Mission
          </CardTitle>
          <CardDescription>{mission.why}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <MiniList
              title="Success looks like"
              items={mission.successLooksLike}
            />
            <MiniList title="Constraints" items={mission.constraints} />
          </div>
          <Progress value={progress}>
            <ProgressLabel>Course progress</ProgressLabel>
            <ProgressValue />
          </Progress>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next lesson</CardTitle>
          <CardDescription>Lesson {nextLesson.number}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="font-medium">{nextLesson.title}</p>
          <p className="text-sm text-muted-foreground">
            {nextLesson.description}
          </p>
        </CardContent>
        {nextLesson.href && (
          <CardContent className="pt-0">
            <a
              href={nextLesson.href}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Start
              <ArrowRight className="size-4" />
            </a>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Due reps</CardTitle>
          <CardDescription>Spaced retrieval queue</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {dueReps.map((rep) => (
              <li
                key={rep.concept}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{rep.concept}</span>
                <Badge
                  variant={rep.strength === "weak" ? "destructive" : "outline"}
                >
                  {rep.due}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-4" />
            References
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {references.map((ref) => (
              <li key={ref.title} className="text-sm">
                {ref.href ? (
                  <a
                    href={ref.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:underline"
                  >
                    {ref.title}
                  </a>
                ) : (
                  <span className="font-medium">{ref.title}</span>
                )}
                <span className="text-muted-foreground">
                  {" "}— {ref.description}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Recent learning records</CardTitle>
          <CardDescription>
            What the learner has actually demonstrated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {recentRecords.slice(0, 3).map((record) => (
              <li key={record.slug} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{record.title}</span>
                <span className="text-muted-foreground">{record.summary}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function MiniList({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-6 text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
