import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

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
    // Surface missing alt in dev so it isn't silently swallowed. An empty
    // alt is valid for decorative images, so we only warn when alt is absent
    // (undefined) — the `?? ""` fallback still keeps rendering safe.
    if (process.env.NODE_ENV !== "production" && props.alt === undefined) {
      console.warn(
        '[Prose] <img> rendered without an alt attribute. Pass alt="" for decorative images.',
        `src: ${props.src ?? ""}`,
      )
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img {...props} className="h-auto max-w-full" alt={props.alt ?? ""} />
    )
  },
}

export function Prose({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`prose prose-slate dark:prose-invert max-w-none break-words ${className || ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={proseComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
