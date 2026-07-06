import { format, formatDistanceToNowStrict, isValid } from "date-fns"

export function formatAnnotationTime(dateInput: string): string {
  const date = new Date(dateInput)
  if (!isValid(date)) return dateInput
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return format(date, "MMM d, yyyy")
  if (diffMs < 60_000) return "just now"
  const days = diffMs / (1000 * 60 * 60 * 24)
  if (days < 7) return formatDistanceToNowStrict(date, { addSuffix: true })
  return format(date, "MMM d, yyyy")
}