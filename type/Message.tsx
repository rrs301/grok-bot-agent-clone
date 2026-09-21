import type { AgentResponse } from "@/lib/openai/agent-response-schema"

export type MessageType = {
    id: string
    role: "user" | "agent" | "assistant"
    content: string
    time: string
    response?: AgentResponse
    toolCards?: ToolSuggestionCardData[]
    editingRoutineId?: string
}

export type ToolSuggestionCardData = {
    slug: string
    name: string
    description: string
    reason: string
    icon?: string
    category?: string | null
    isConnected: boolean
    isEnabled: boolean
}

// Kept as an alias for callers that used the earlier name.
export type ToolConnectionCardData = ToolSuggestionCardData
