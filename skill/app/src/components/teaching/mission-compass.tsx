import { Target } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MissionModel } from "./types"

export type MissionCompassProps = MissionModel

export function MissionCompass({
  why,
  successLooksLike,
  constraints,
  outOfScope,
}: MissionCompassProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-5" />
          Mission
        </CardTitle>
        <CardDescription>{why}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <ListSection title="Success looks like" items={successLooksLike} />
        <ListSection title="Constraints" items={constraints} />
        <ListSection title="Out of scope" items={outOfScope} />
      </CardContent>
    </Card>
  )
}

function ListSection({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
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
