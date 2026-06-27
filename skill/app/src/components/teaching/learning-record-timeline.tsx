import { CheckCircle2, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LearningRecord } from "./types"

export interface LearningRecordTimelineProps {
  records: LearningRecord[]
}

export function LearningRecordTimeline({
  records,
}: LearningRecordTimelineProps) {
  return (
    <div className="flex flex-col gap-4">
      {records.map((record, index) => (
        <div key={record.slug} className="relative flex gap-4">
          {index !== records.length - 1 && (
            <div className="absolute bottom-[-16px] left-[11px] top-8 w-px bg-border" />
          )}
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background">
            <CheckCircle2 className="size-3.5 text-muted-foreground" />
          </div>
          <Card className="flex-1">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">{record.title}</CardTitle>
                {record.status?.startsWith("superseded") && (
                  <Badge variant="secondary">
                    <RotateCcw className="size-3" />
                    Superseded
                  </Badge>
                )}
              </div>
              <CardDescription>
                LR-{String(record.number).padStart(4, "0")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{record.summary}</p>
              {record.evidence && (
                <p className="text-sm">
                  <span className="font-medium">Evidence:</span>{" "}
                  <span className="text-muted-foreground">
                    {record.evidence}
                  </span>
                </p>
              )}
              {record.misconceptionCorrected && (
                <p className="text-sm">
                  <span className="font-medium">Fixed misconception:</span>{" "}
                  <span className="text-muted-foreground">
                    {record.misconceptionCorrected}
                  </span>
                </p>
              )}
              {record.implication && (
                <p className="text-sm">
                  <span className="font-medium">Implication:</span>{" "}
                  <span className="text-muted-foreground">
                    {record.implication}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}
