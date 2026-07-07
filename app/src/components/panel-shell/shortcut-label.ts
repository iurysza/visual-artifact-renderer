export function shortcutLabel(): string {
  if (
    typeof navigator !== "undefined" &&
    navigator.platform?.toLowerCase().includes("mac")
  ) {
    return "⌘ + Enter"
  }
  return "Ctrl + Enter"
}