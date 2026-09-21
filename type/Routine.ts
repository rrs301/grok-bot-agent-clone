import type { RoutineDraft } from "@/lib/openai/agent-response-schema"

export type SavedRoutine = RoutineDraft & {
  id: string
  agentId: string
  isActive: boolean
  nextRunAt: string | null
  executionStatus?: "queued" | "running" | "completed" | "failed" | "skipped"
  latestExecutionId?: string | null
  latestExecutionError?: string | null
  latestExecutionCompletedAt?: string | null
}

export type RoutineEditEventDetail = {
  agentId: string
  routine: SavedRoutine
}

export type RoutinesChangedEventDetail = {
  agentId: string
}
