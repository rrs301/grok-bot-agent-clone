"use client"

import type { RoutineDraft } from "@/lib/openai/agent-response-schema"
import type { ToolSuggestionCardData } from "@/type/Message"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, CheckCircle2, Clock3, Globe2, Repeat2, Sparkles } from "lucide-react"
import { useState } from "react"
import { ToolSuggestionCard } from "./ToolSuggestionCard"

type RoutineCardProps = {
  agentId: string
  routine: RoutineDraft
  toolCards: ToolSuggestionCardData[]
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

export function RoutineCard({ agentId, routine, toolCards }: RoutineCardProps) {
  const [tools, setTools] = useState(toolCards)
  const cardsBySlug = new Map(
    tools.map((tool) => [tool.slug.toLowerCase(), tool])
  )
  const requiredTools = routine.tools.map((suggestion) => {
    const card = cardsBySlug.get(suggestion.slug.toLowerCase())

    return card
      ? { ...card, reason: suggestion.reason }
      : {
          slug: suggestion.slug,
          name: displayToolName(suggestion.slug),
          description: "Tool details are not available in the current catalog.",
          reason: suggestion.reason,
          isConnected: false,
          isEnabled: false,
        }
  })
  const allConnected = requiredTools.every(
    (tool) => tool.isEnabled && tool.isConnected
  )
  const updateConnection = (slug: string, isConnected: boolean) => {
    setTools((current) =>
      current.map((tool) =>
        tool.slug.toLowerCase() === slug.toLowerCase()
          ? { ...tool, isConnected }
          : tool
      )
    )
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
