"use client"

import type { RoutineDraft } from "@/lib/openai/agent-response-schema"
import type { ToolSuggestionCardData } from "@/type/Message"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import axios, { AxiosError } from "axios"
import { CalendarDays, CheckCircle2, Clock3, Globe2, Loader2, Repeat2, Sparkles } from "lucide-react"
import { useState } from "react"
import { ToolSuggestionCard } from "./ToolSuggestionCard"

type RoutineCardProps = {
  agentId: string
  routine: RoutineDraft
  toolCards: ToolSuggestionCardData[]
  routineId?: string
  onSaved?: () => void
}

const weekDayLabels: Record<RoutineDraft["schedule"]["weekDays"][number], string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
}

function displayToolName(slug: string) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function isValidRoutineTime(value: string) {
  const trimmed = value.trim()

  return Boolean(
    /^\d{2}:\d{2}$/.test(trimmed)
    || /^(?:0?[1-9]|1[0-2]):[0-5]\d\s?[AP]M$/i.test(trimmed)
  )
}

export function RoutineCard({
  agentId,
  routine,
  toolCards,
  routineId,
  onSaved,
}: RoutineCardProps) {
  const [tools, setTools] = useState(toolCards)
  const [isCreating, setIsCreating] = useState(false)
  const [isCreated, setIsCreated] = useState(false)
  const cardsBySlug = new Map(
    tools.map((tool) => [tool.slug.toLowerCase(), tool])
  )
  const requiredTools = routine.tools.flatMap((suggestion) => {
    const card = cardsBySlug.get(suggestion.slug.toLowerCase())

    if (!card) return []

    return [{ ...card, reason: suggestion.reason }]
  })
  const allConnected = requiredTools.length === 0 || requiredTools.every(
    (tool) => tool.isEnabled && tool.isConnected
  )
  const normalizedStartDate = routine.schedule.startDate.trim()
  const normalizedTime = routine.schedule.time.trim()
  const normalizedTimezone = routine.schedule.timezone.trim()
  const hasCompleteDetails = Boolean(
    routine.name.trim()
    && routine.goal.trim()
    && routine.instructions.trim()
    && /^\d{4}-\d{2}-\d{2}$/.test(normalizedStartDate)
    && isValidRoutineTime(normalizedTime)
    && normalizedTimezone
    && (routine.schedule.frequency !== "weekly" || routine.schedule.weekDays.length > 0)
  )
  const isReady = hasCompleteDetails && allConnected
  const updateConnection = (slug: string, isConnected: boolean) => {
    setTools((current) =>
      current.map((tool) =>
        tool.slug.toLowerCase() === slug.toLowerCase()
          ? { ...tool, isConnected }
          : tool
      )
    )
  }
  const createRoutine = async () => {
    setIsCreating(true)

    try {
      if (routineId) {
        await axios.patch("/api/routines", { agentId, routineId, routine })
      } else {
        await axios.post("/api/routines", { agentId, routine })
      }
      setIsCreated(true)
      window.dispatchEvent(new CustomEvent("routines-changed", { detail: { agentId } }))
      onSaved?.()
      toast.add({
        title: routineId ? "Routine updated" : "Routine created",
        description: `Your agent will run ${routineId ? "the updated routine" : "it"} at the scheduled time.`,
        type: "success",
      })
    } catch (error) {
      const description = error instanceof AxiosError
        && typeof error.response?.data?.error === "string"
        ? error.response.data.error
        : `Unable to ${routineId ? "update" : "create"} this routine.`
      toast.add({ title: `Could not ${routineId ? "update" : "create"} routine`, description, type: "error" })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <Sparkles className="size-3.5" />
          Suggested routine
        </div>
        <h3 className="mt-2 text-base font-semibold leading-6">{routine.name}</h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{routine.goal}</p>
      </div>

      <div className="space-y-5 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Instructions
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">
            {routine.instructions}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <ScheduleDetail icon={CalendarDays} label="Starts" value={routine.schedule.startDate} />
          <ScheduleDetail icon={Clock3} label="Time" value={routine.schedule.time} />
          <ScheduleDetail icon={Repeat2} label="Frequency" value={routine.schedule.frequency} />
          <ScheduleDetail icon={Globe2} label="Timezone" value={routine.schedule.timezone} />
        </div>

        {routine.schedule.weekDays.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {routine.schedule.weekDays.map((day) => (
              <Badge key={day} variant="secondary">
                {weekDayLabels[day]}
              </Badge>
            ))}
          </div>
        )}

        <div>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Required tools
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Suggested from the routine requirements
              </p>
            </div>
            {requiredTools.length > 0 && allConnected && (
              <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 data-icon="inline-start" /> Ready
              </Badge>
            )}
          </div>

          {requiredTools.length > 0 ? (
            <div className="space-y-2.5">
              {requiredTools.map((tool) => (
                <ToolSuggestionCard
                  key={tool.slug}
                  agentId={agentId}
                  tool={tool}
                  onConnectionChange={updateConnection}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              This routine does not require an external tool.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs leading-5 text-muted-foreground">
            {isCreated
              ? "This routine is active and scheduled."
              : isReady
                ? "Review the details, then confirm this automation."
                : !hasCompleteDetails
                  ? "The agent still needs complete schedule details."
                  : "Connect every required tool to continue."}
          </p>
          <Button
            className="shrink-0"
            disabled={!isReady || isCreating || isCreated}
            onClick={createRoutine}
          >
            {isCreating ? (
              <Loader2 className="animate-spin" />
            ) : isCreated ? (
              <CheckCircle2 />
            ) : (
              <Sparkles />
            )}
            {isCreating
              ? routineId ? "Updating..." : "Creating..."
              : isCreated
                ? routineId ? "Updated" : "Created"
                : routineId ? "Update routine" : "Create routine"}
          </Button>
        </div>
      </div>
    </section>
  )
}

type ScheduleDetailProps = {
  icon: typeof CalendarDays
  label: string
  value: string
}

function ScheduleDetail({ icon: Icon, label, value }: ScheduleDetailProps) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-medium capitalize">{value}</p>
      </div>
    </div>
  )
}
