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
  img: (props) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} className="h-auto max-w-full" alt={props.alt ?? ""} />
  ),
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
