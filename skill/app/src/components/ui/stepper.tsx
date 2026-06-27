import * as React from "react"

import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type StepStatus = "complete" | "current" | "pending"

interface StepperItem {
  title: string
  description?: string
  status?: StepStatus
}

interface StepperProps extends React.ComponentProps<"div"> {
  items: StepperItem[]
}

function Stepper({ className, items, ...props }: StepperProps) {
  return (
    <div
      data-slot="stepper"
      className={cn("w-full", className)}
      {...props}
    >
      <ol className="flex w-full list-none">
        {items.map((item, index) => {
          const status = item.status ?? "pending"
          const isComplete = status === "complete"
          const isCurrent = status === "current"
          const isPending = status === "pending"
          const isLast = index === items.length - 1

          return (
            <li
              key={index}
              className="relative flex flex-1 flex-col items-center"
              aria-current={isCurrent ? "step" : undefined}
            >
              {!isLast && (
                <div
                  className={cn(
                    "absolute top-5 left-1/2 ml-5 h-0.5 w-[calc(100%-2.5rem)] -translate-y-1/2",
                    isComplete ? "bg-primary" : "bg-border"
                  )}
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex size-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  isComplete &&
                    "border-primary bg-primary text-primary-foreground",
                  isCurrent &&
                    "border-primary bg-card text-foreground ring-2 ring-ring/50",
                  isPending &&
                    "border-border bg-card text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <CheckIcon className="size-5" aria-hidden="true" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="mt-3 w-full space-y-1 px-2 text-center">
                <p
                  className={cn(
                    "min-w-0 break-words font-serif text-base font-medium tracking-[-0.02em]",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {item.title}
                </p>
                {item.description && (
                  <p className="min-w-0 break-words text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export { Stepper }
export type { StepperItem, StepperProps, StepStatus }
