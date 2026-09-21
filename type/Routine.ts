import type { RoutineDraft } from "@/lib/openai/agent-response-schema"

export type SavedRoutine = RoutineDraft & {
  id: string
  agentId: string
  isActive: boolean
  nextRunAt: string | null
}

export type RoutineEditEventDetail = {
  agentId: string
  routine: SavedRoutine
}

export type RoutinesChangedEventDetail = {
  agentId: string
}
