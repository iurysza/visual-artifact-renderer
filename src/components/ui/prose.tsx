import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Badge } from "@/components/ui/badge"

const proseComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props}>{children}</table>
    </div>
  ),
  pre: ({ children, ...props }) => (
    <pre {...props} className="overflow-x-auto">
      {children}
    </pre>
  ),
  img: (props) => {
    // Surface missing alt visibly and in the console. An empty alt is valid
    // for decorative images, so we only reject absent (undefined) alt values.
    const hasAlt = props.alt !== undefined
    if (process.env.NODE_ENV !== "production" && !hasAlt) {
      console.warn(
        '[Prose] <img> rendered without an alt attribute. Pass alt="" for decorative images.',
        `src: ${props.src ?? ""}`,
      )
    }
    return (
      <span className="relative inline-block max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...props} className="h-auto max-w-full" alt={props.alt ?? ""} />
        {!hasAlt && (
          <Badge
            variant="destructive"
            className="absolute top-2 left-2 pointer-events-none"
          >
            Missing alt
          </Badge>
        )}
      </span>
    )
  },
}

export function Prose({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`prose max-w-none break-words ${className || ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={proseComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
