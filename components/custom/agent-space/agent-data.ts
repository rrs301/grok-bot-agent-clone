import { CalendarDays, CirclePause, Copy, Github, Mail, MessageSquare, NotepadText, RefreshCcw } from "lucide-react"

export const agent = {
  name: "Nova",
  instructions: "A thoughtful research assistant that turns scattered information into clear, useful answers. Be concise, practical, and friendly. Ask a clarifying question when a request is ambiguous. Use clear headings for longer answers, surface important assumptions, and finish with a useful next step.",
}

export const connectedTools = [
  { name: "Gmail", description: "Read and draft emails", icon: Mail, color: "text-red-500", bg: "bg-red-50" },
  { name: "Slack", description: "Search team conversations", icon: MessageSquare, color: "text-violet-600", bg: "bg-violet-50" },
  { name: "Google Calendar", description: "View events and availability", icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50" },
  { name: "Notion", description: "Find pages and documents", icon: NotepadText, color: "text-neutral-800", bg: "bg-neutral-100" },
  { name: "GitHub", description: "Access repositories and issues", icon: Github, color: "text-neutral-800", bg: "bg-neutral-100" },
]

export const agentActions = [
  { name: "Pause Agent", description: "Temporarily stop all activity", icon: CirclePause },
]
