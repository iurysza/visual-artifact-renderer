import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface DefinitionListProps extends React.ComponentProps<typeof Card> {
  items: { term: string; description: string }[]
}

function DefinitionList({ items, className, ...props }: DefinitionListProps) {
  return (
    <Card
      data-slot="definition-list"
      className={cn("overflow-hidden py-0", className)}
      {...props}
    >
      <CardContent className="p-0">
        <dl>
          {items.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <Separator />}
              <div className="flex items-baseline justify-between gap-4 px-(--card-spacing) py-3">
                <dt className="text-sm text-muted-foreground">{item.term}</dt>
                <dd className="break-all text-right text-sm font-medium font-mono text-foreground">
                  {item.description}
                </dd>
              </div>
            </React.Fragment>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

export { DefinitionList }
