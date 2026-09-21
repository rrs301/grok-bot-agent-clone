"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { CheckCircle2, Clock3, Loader2, RefreshCw, XCircle } from "lucide-react"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

type RoutineExecutionHistoryItem = {
  id: string
  routineName: string
  status: "queued" | "running" | "completed" | "failed" | "skipped"
  outputSummary: string
  scheduledFor: string
  startedAt: string | null
  completedAt: string | null
  updatedAt: string
}

const runningStatuses = new Set(["queued", "running"])

function formatDateTime(value: string | null) {
  if (!value) return "Not completed"

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function statusBadgeVariant(status: RoutineExecutionHistoryItem["status"]) {
  if (status === "completed") return "secondary"
  if (status === "failed") return "destructive"
  return "outline"
}

function StatusIcon({ status }: { status: RoutineExecutionHistoryItem["status"] }) {
  if (status === "completed") return <CheckCircle2 className="size-3.5 text-emerald-600" />
  if (status === "failed") return <XCircle className="size-3.5 text-destructive" />
  if (status === "running" || status === "queued") return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
  return <Clock3 className="size-3.5 text-muted-foreground" />
}

export function RoutineExecutionHistoryTab() {
  const { agentId } = useParams<{ agentId: string }>()
  const [executions, setExecutions] = useState<RoutineExecutionHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadExecutions = useCallback(async (showRefresh = false) => {
    if (!agentId) return
    if (showRefresh) setIsRefreshing(true)

    try {
      const { data } = await axios.get<{ executions: RoutineExecutionHistoryItem[] }>(
        "/api/routines/executions",
        { params: { agentId } }
      )
      setExecutions(data.executions)
    } catch {
      setExecutions([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [agentId])

  useEffect(() => {
    loadExecutions()
  }, [loadExecutions])

  useEffect(() => {
    const hasRunningExecution = executions.some((execution) =>
      runningStatuses.has(execution.status)
    )
    if (!hasRunningExecution) return

    const intervalId = window.setInterval(() => {
      loadExecutions()
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [executions, loadExecutions])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Routine execution history</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Recent routine runs and their recorded outcomes.
          </p>
        </div>
        <Button
          aria-label="Refresh routine execution history"
          className="size-8 shrink-0"
          disabled={isRefreshing}
          onClick={() => loadExecutions(true)}
          size="icon"
          variant="outline"
        >
          {isRefreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border p-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : executions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-5 text-center">
          <Clock3 className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No executions yet</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Routine runs will appear here after they are queued or completed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {executions.map((execution) => (
            <article className="rounded-lg border bg-background p-3.5" key={execution.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{execution.routineName}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusIcon status={execution.status} />
                    <span>{formatDateTime(execution.completedAt)}</span>
                  </div>
                </div>
                <Badge className="shrink-0 capitalize" variant={statusBadgeVariant(execution.status)}>
                  {execution.status}
                </Badge>
              </div>
              <p className="mt-3 line-clamp-4 text-xs leading-5 text-muted-foreground">
                {execution.outputSummary}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
