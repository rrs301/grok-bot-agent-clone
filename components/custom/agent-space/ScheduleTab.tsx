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
import type { RoutineEditEventDetail, RoutinesChangedEventDetail, SavedRoutine } from "@/type/Routine"
import axios from "axios"
import { CalendarClock, Clock3, Loader2, MoreHorizontal, Pencil, PowerOff, Repeat2, Trash2 } from "lucide-react"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

export function ScheduleTab() {
  const { agentId } = useParams<{ agentId: string }>()
  const [routines, setRoutines] = useState<SavedRoutine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [routineToDelete, setRoutineToDelete] = useState<SavedRoutine | null>(null)
  const [routineToDeactivate, setRoutineToDeactivate] = useState<SavedRoutine | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [activateRoutineId, setActivateRoutineId] = useState<string | null>(null)

  useEffect(() => {
    if (!agentId) return

    let isMounted = true
    const loadRoutines = () => {
      axios
        .get<{ routines: SavedRoutine[] }>("/api/routines", { params: { agentId } })
        .then(({ data }) => {
          if (isMounted) setRoutines(data.routines)
        })
        .catch(() => {
          if (isMounted) setRoutines([])
        })
        .finally(() => {
          if (isMounted) setIsLoading(false)
        })
    }
    const handleRoutinesChanged = (event: Event) => {
      const createdAgentId = (event as CustomEvent<RoutinesChangedEventDetail>).detail?.agentId
      if (createdAgentId === agentId) loadRoutines()
    }

    loadRoutines()
    window.addEventListener("routines-changed", handleRoutinesChanged)

    return () => {
      isMounted = false
      window.removeEventListener("routines-changed", handleRoutinesChanged)
    }
  }, [agentId])

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
                  <Badge variant={routine.isActive ? "secondary" : "outline"}>
                    {routine.isActive ? "Active" : "Inactive"}
                  </Badge>
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
