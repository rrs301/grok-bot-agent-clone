"use client"

import { Loader2, PauseCircle, PlayCircle, Trash2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AgentConfigContext } from "@/context/AgentConfigContext"
import { toast } from "@/components/ui/toast"
import axios, { AxiosError } from "axios"
import { useRouter } from "next/navigation"
import { useContext, useState } from "react"

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.error
    if (typeof message === "string") return message
  }

  return fallback
}

export function AgentSettingsTab() {
  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const router = useRouter()

  const isPaused = agentConfig?.e2bSandboxStatus === "paused"
  const isActive = !isPaused

  const updateAgentStatus = async (nextActive: boolean) => {
    if (!agentConfig?.agentId) return

    const previousStatus = agentConfig.e2bSandboxStatus
    const nextStatus = nextActive ? "active" : "paused"
    const nextPausedAt = nextActive ? null : new Date().toISOString()

    setIsUpdatingStatus(true)
    setAgentConfig((current: any) => ({
      ...current,
      e2bSandboxStatus: nextStatus,
      e2bPausedAt: nextPausedAt,
    }))

    try {
      await axios.put("/api/agent", {
        ...agentConfig,
        e2bSandboxStatus: nextStatus,
        e2bPausedAt: nextPausedAt,
      })

      toast.add({
        title: nextActive ? "Agent resumed" : "Agent paused",
        description: nextActive
          ? "This agent is active again."
          : "This agent is inactive until you resume it.",
        type: "success",
      })
    } catch (error) {
      setAgentConfig((current: any) => ({
        ...current,
        e2bSandboxStatus: previousStatus,
      }))
      toast.add({
        title: "Could not update agent status",
        description: getErrorMessage(error, "Please try again in a moment."),
        type: "error",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const deleteAgent = async () => {
    if (!agentConfig?.agentId) return

    setIsDeleting(true)

    try {
      await axios.delete("/api/agent", {
        params: { agentId: agentConfig.agentId },
      })

      toast.add({
        title: "Agent deleted",
        description: `${agentConfig.name} has been permanently deleted.`,
        type: "success",
      })
      setIsDeleteDialogOpen(false)
      router.push("/workspace")
      router.refresh()
    } catch (error) {
      toast.add({
        title: "Could not delete agent",
        description: getErrorMessage(error, "Please try again in a moment."),
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <h3 className="font-semibold">Agent management</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          General options for this agent.
        </p>
      </div>

      <div className="rounded-xl border bg-background p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            {isActive ? (
              <PlayCircle className="size-4 text-emerald-600" />
            ) : (
              <PauseCircle className="size-4 text-amber-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Agent activity</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Pause this agent to make it inactive until you resume it.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isUpdatingStatus && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                <Switch
                  checked={isActive}
                  disabled={isUpdatingStatus || !agentConfig?.agentId}
                  onCheckedChange={updateAgentStatus}
                  aria-label="Toggle agent activity"
                />
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs">
              Current status:{" "}
              <span className="font-medium text-foreground">
                {isActive ? "Active" : "Paused"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] p-4">
        <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Permanently delete this agent, routines, workflows, and conversation history.
        </p>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogTrigger render={<Button className="mt-4" variant="destructive" />}>
            <Trash2 className="size-4" />
            Delete Agent
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <TriangleAlert className="size-5" />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete {agentConfig?.name || "this agent"}?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The agent, its routines, workflow state, and chat history will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
                onClick={deleteAgent}
              >
                {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {isDeleting ? "Deleting..." : "Delete Agent"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
