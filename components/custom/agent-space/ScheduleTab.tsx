"use client"

import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { RoutineEditEventDetail, RoutinesChangedEventDetail, SavedRoutine } from "@/type/Routine"
import axios from "axios"
import { CalendarClock, Clock3, Loader2, MoreHorizontal, Pencil, Play, PowerOff, Repeat2, Trash2 } from "lucide-react"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

const runningStatuses = new Set(["queued", "running"])
const terminalStatuses = new Set(["completed", "failed", "skipped"])

export function ScheduleTab() {
  const { agentId } = useParams<{ agentId: string }>()
  const [routines, setRoutines] = useState<SavedRoutine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [routineToDelete, setRoutineToDelete] = useState<SavedRoutine | null>(null)
  const [routineToDeactivate, setRoutineToDeactivate] = useState<SavedRoutine | null>(null)
  const [routineToRun, setRoutineToRun] = useState<SavedRoutine | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [isRunStarting, setIsRunStarting] = useState(false)
  const [activateRoutineId, setActivateRoutineId] = useState<string | null>(null)
  const seenExecutionIds = useRef(new Set<string>())

  const loadRoutines = useCallback(() => {
    if (!agentId) return Promise.resolve()

    return axios
      .get<{ routines: SavedRoutine[] }>("/api/routines", { params: { agentId } })
      .then(({ data }) => {
        setRoutines((current) => {
          const previousById = new Map(current.map((routine) => [routine.id, routine]))

          for (const nextRoutine of data.routines) {
            const previous = previousById.get(nextRoutine.id)
            const executionId = nextRoutine.latestExecutionId
            if (!executionId || seenExecutionIds.current.has(executionId)) continue

            if (
              previous?.latestExecutionId === executionId
              && previous.executionStatus
              && runningStatuses.has(previous.executionStatus)
              && nextRoutine.executionStatus
              && terminalStatuses.has(nextRoutine.executionStatus)
            ) {
              seenExecutionIds.current.add(executionId)
              toast.add({
                title: nextRoutine.executionStatus === "completed"
                  ? "Routine finished"
                  : "Routine failed",
                description: nextRoutine.executionStatus === "completed"
                  ? `“${nextRoutine.name}” completed successfully.`
                  : nextRoutine.latestExecutionError ?? `“${nextRoutine.name}” did not complete.`,
                type: nextRoutine.executionStatus === "completed" ? "success" : "error",
              })
            }
          }

          return data.routines
        })
      })
      .catch(() => {
        setRoutines([])
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [agentId])

  useEffect(() => {
    if (!agentId) return

    const handleRoutinesChanged = (event: Event) => {
      const changedAgentId = (event as CustomEvent<RoutinesChangedEventDetail>).detail?.agentId
      if (changedAgentId === agentId) loadRoutines()
    }

    loadRoutines()
    window.addEventListener("routines-changed", handleRoutinesChanged)

    return () => {
      window.removeEventListener("routines-changed", handleRoutinesChanged)
    }
  }, [agentId, loadRoutines])

  useEffect(() => {
    const hasRunningRoutine = routines.some((routine) =>
      routine.executionStatus && runningStatuses.has(routine.executionStatus)
    )
    if (!hasRunningRoutine) return

    const intervalId = window.setInterval(() => {
      loadRoutines()
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [loadRoutines, routines])

  const runRoutine = async () => {
    if (!routineToRun) return
    setIsRunStarting(true)

    try {
      const { data } = await axios.post<{
        execution: {
          id: string
          status: SavedRoutine["executionStatus"]
          error: string | null
          completedAt: string | null
        }
        alreadyRunning: boolean
      }>("/api/routines/run", {
        agentId,
        routineId: routineToRun.id,
      })

      setRoutines((current) =>
        current.map((routine) =>
          routine.id === routineToRun.id
            ? {
              ...routine,
              executionStatus: data.execution.status,
              latestExecutionId: data.execution.id,
              latestExecutionError: data.execution.error,
              latestExecutionCompletedAt: data.execution.completedAt,
            }
            : routine
        )
      )
      setRoutineToRun(null)
      toast.add({
        title: data.alreadyRunning ? "Routine already running" : "Routine started",
        description: data.alreadyRunning
          ? "This routine is already executing, so a duplicate run was not started."
          : `“${routineToRun.name}” is executing now.`,
        type: data.alreadyRunning ? "info" : "loading",
      })
      window.dispatchEvent(new CustomEvent("routines-changed", { detail: { agentId } }))
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.error ?? "Please try again."
        : "Please try again."
      toast.add({
        title: "Could not run routine",
        description,
        type: "error",
      })
    } finally {
      setIsRunStarting(false)
    }
  }

  const editRoutine = (routine: SavedRoutine) => {
    window.dispatchEvent(new CustomEvent<RoutineEditEventDetail>("routine-edit-requested", {
      detail: { agentId, routine },
    }))
  }

  const setRoutineActiveState = async (id: string, isActive: boolean) => {
    setIsDeactivating(true)

    try {
      await axios.patch("/api/routines", {
        agentId,
        routineId: id,
        isActive,
      })

      setRoutines((current) =>
        current.map((routine) =>
          routine.id === id
            ? { ...routine, isActive }
            : routine
        )
      )
      setRoutineToDeactivate(null)
      setActivateRoutineId(null)
      window.dispatchEvent(new CustomEvent("routines-changed", { detail: { agentId } }))
      toast.add({
        title: isActive ? "Routine activated" : "Routine deactivated",
        description: isActive
          ? "It will run again on its scheduled time."
          : "It will stay saved but will not run again until reactivated.",
        type: "success",
      })
    } catch {
      toast.add({
        title: isActive ? "Could not activate routine" : "Could not deactivate routine",
        description: "Please try again.",
        type: "error",
      })
    } finally {
      setIsDeactivating(false)
    }
  }

  const deactivateRoutine = async () => {
    if (!routineToDeactivate) return
    await setRoutineActiveState(routineToDeactivate.id, false)
  }

  const activateRoutine = async () => {
    if (!activateRoutineId) return
    await setRoutineActiveState(activateRoutineId, true)
  }

  const deleteRoutine = async () => {
    if (!routineToDelete) return
    setIsDeleting(true)

    try {
      await axios.delete("/api/routines", {
        params: { agentId, routineId: routineToDelete.id },
      })
      setRoutines((current) => current.filter((routine) => routine.id !== routineToDelete.id))
      setRoutineToDelete(null)
      toast.add({
        title: "Routine deleted",
        description: "The routine will no longer run.",
        type: "success",
      })
    } catch {
      toast.add({
        title: "Could not delete routine",
        description: "Please try again.",
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">Execution schedule</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Routines created in chat run automatically on behalf of this agent.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border p-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : routines.length === 0 ? (
        <div className="rounded-xl border border-dashed p-5 text-center">
          <CalendarClock className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No routines yet</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Ask the agent to do something on a schedule, then confirm its routine card.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map((routine) => (
            <article className="rounded-xl border bg-background p-3.5" key={routine.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{routine.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {routine.goal}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant={
                    routine.executionStatus && runningStatuses.has(routine.executionStatus)
                      ? "default"
                      : routine.isActive ? "secondary" : "outline"
                  }>
                    {routine.executionStatus && runningStatuses.has(routine.executionStatus)
                      ? "Running"
                      : routine.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={(
                          <Button
                            aria-label={`Run ${routine.name}`}
                            className="size-7"
                            disabled={
                              !routine.isActive
                              || Boolean(routine.executionStatus && runningStatuses.has(routine.executionStatus))
                            }
                            onClick={() => setRoutineToRun(routine)}
                            size="icon"
                            variant="ghost"
                          />
                        )}
                      >
                        {routine.executionStatus && runningStatuses.has(routine.executionStatus)
                          ? <Loader2 className="animate-spin" />
                          : <Play />}
                      </TooltipTrigger>
                      <TooltipContent>
                        {routine.executionStatus && runningStatuses.has(routine.executionStatus)
                          ? "Running"
                          : "Run now"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={(
                        <Button
                          aria-label={`Actions for ${routine.name}`}
                          className="size-7"
                          size="icon"
                          variant="ghost"
                        />
                      )}
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => editRoutine(routine)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      {routine.isActive ? (
                        <DropdownMenuItem onClick={() => setRoutineToDeactivate(routine)}>
                          <PowerOff /> Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setActivateRoutineId(routine.id)}>
                          <PowerOff /> Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setRoutineToDelete(routine)}
                        variant="destructive"
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Repeat2 className="size-3.5" />
                  <span className="capitalize">{routine.schedule.frequency}</span>
                  <span>at {routine.schedule.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="size-3.5" />
                  <span>
                    {routine.nextRunAt
                      ? `Next: ${new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: routine.schedule.timezone,
                      }).format(new Date(routine.nextRunAt))}`
                      : "No future runs"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(routineToRun)}
        onOpenChange={(open) => {
          if (!open && !isRunStarting) setRoutineToRun(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run this routine now?</AlertDialogTitle>
            <AlertDialogDescription>
              “{routineToRun?.name}” will start immediately instead of waiting for its scheduled time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunStarting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isRunStarting} onClick={runRoutine}>
              {isRunStarting && <Loader2 className="animate-spin" />}
              {isRunStarting ? "Starting..." : "Run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(routineToDeactivate)}
        onOpenChange={(open) => {
          if (!open && !isDeactivating) setRoutineToDeactivate(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this routine?</AlertDialogTitle>
            <AlertDialogDescription>
              “{routineToDeactivate?.name}” will stop running on its schedule until you reactivate it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeactivating} onClick={deactivateRoutine}>
              {isDeactivating && <Loader2 className="animate-spin" />}
              {isDeactivating ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(activateRoutineId)}
        onOpenChange={(open) => {
          if (!open && !isDeactivating) setActivateRoutineId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate this routine?</AlertDialogTitle>
            <AlertDialogDescription>
              This routine will begin running again on its schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeactivating} onClick={activateRoutine}>
              {isDeactivating && <Loader2 className="animate-spin" />}
              {isDeactivating ? "Activating..." : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(routineToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setRoutineToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this routine?</AlertDialogTitle>
            <AlertDialogDescription>
              “{routineToDelete?.name}” will be permanently removed and will not run again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={deleteRoutine}
              variant="destructive"
            >
              {isDeleting && <Loader2 className="animate-spin" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
