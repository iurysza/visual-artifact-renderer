"use client"

import type { CSSProperties } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Figure, PanelCard, columnsClass, tonePanelClass } from "@/components/artifact-primitives"
import { cn } from "@/lib/utils"
import { StatusChip, statusIsVisible } from "@/lib/status"

import type { AdapterArgs } from "@/components/component-registry"
import type { ArtifactFlowItem } from "@/lib/artifact-schema"

export function renderCard({ node, children }: AdapterArgs<"card">) {
  const props = node.props ?? {}

  return (
    <Card size={props.size} className={tonePanelClass(props.tone)}>
      {(props.title || props.description) && (
        <CardHeader>
          {props.title && <CardTitle>{props.title}</CardTitle>}
          {props.description && <CardDescription>{props.description}</CardDescription>}
        </CardHeader>
      )}
      {children && <CardContent className="flex flex-col gap-4">{children}</CardContent>}
    </Card>
  )
}

export function renderGrid({ node, children }: AdapterArgs<"grid">) {
  const columns = node.props?.columns ?? 2

  return <div className={cn("grid gap-5", columnsClass(columns))}>{children}</div>
}

export function renderSection({ node, children }: AdapterArgs<"section">) {
  const props = node.props ?? {}

  return (
    <section className="flex scroll-mt-8 flex-col gap-5">
      <Separator />
      {(props.title || props.description) && (
        <div className="pb-1">
          {props.title && (
            <h2 className="font-serif text-3xl font-medium tracking-[-0.025em] text-foreground">
              {props.title}
            </h2>
          )}
          {props.description && (
            <p className="mt-2 max-w-3xl text-muted-foreground">{props.description}</p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

export function renderTabs({ node, context, renderNodes }: AdapterArgs<"tabs">) {
  const defaultValue = node.props.defaultValue ?? node.props.items[0]?.value

  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        {node.props.items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {node.props.items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="flex flex-col gap-5 pt-1">
          {renderNodes(item.nodes, context)}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function renderAccordion({ node, context, renderNodes }: AdapterArgs<"accordion">) {
  return (
    <Accordion>
      {node.props.items.map((item, index) => (
        <AccordionItem key={item.title} value={`item-${index}`}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4">{renderNodes(item.nodes, context)}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

export function renderFlow({ node }: AdapterArgs<"flow">) {
  const { title, caption, items } = node.props

  return (
    <Figure title={title} caption={caption}>
      <div
        className="grid gap-3 lg:grid-cols-[repeat(var(--flow-columns),minmax(0,1fr))]"
        style={{ "--flow-columns": items.length } as CSSProperties}
      >
        {items.map((item, index) => (
          <FlowStep key={`${item.title}-${index}`} item={item} index={index} />
        ))}
      </div>
    </Figure>
  )
}

function FlowStep({ item, index }: { item: ArtifactFlowItem; index: number }) {
  const description = item.description

  return (
    <div className="relative">
      <PanelCard tone={item.status}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card font-mono text-xs font-medium text-muted-foreground">
            {index + 1}
          </span>
          {statusIsVisible(item.status, description) && (
            <StatusChip value={item.status} className="max-w-[50%] justify-start" />
          )}
        </div>
        {item.label && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--clay)]">
            {item.label}
          </p>
        )}
        <p className="mt-1 truncate font-serif text-lg font-medium leading-snug tracking-[-0.015em] text-foreground">
          {item.title}
        </p>
        {description && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </PanelCard>
    </div>
  )
}
