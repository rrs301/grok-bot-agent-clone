"use client"

import axios from "axios"
import { useContext, useEffect, useRef, useState } from "react"
import { LoaderCircle, Maximize2, Monitor, Play, Power, RotateCw, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AgentConfigContext } from "@/context/AgentConfigContext"
import { cn } from "cn"

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000

type VmStatus = "active" | "inactive" | "paused" | "unconfigured" | "error"

export function VMDesktop() {
  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext)
  const [status, setStatus] = useState<VmStatus>("inactive")
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const agentId = agentConfig?.agentId
  const hasSandbox = Boolean(agentConfig?.e2bSandboxId)

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }

  const pauseVm = async () => {
    if (!agentId || status !== "active") return

    try {
      const result = await axios.post("/api/agent/vm", {
        agentId,
        action: "pause",
      })
      setStatus(result.data.status ?? "paused")
      setStreamUrl(null)
      setIsOpen(false)

      if (result.data.agentConfig) {
        setAgentConfig(result.data.agentConfig)
      }
    } catch (error: any) {
      setStatus("error")
      setMessage(error?.response?.data?.error ?? "Unable to pause VM desktop.")
    }
  }

  const scheduleIdlePause = () => {
    clearIdleTimer()

    if (isOpen || status !== "active") return

    idleTimerRef.current = setTimeout(() => {
      pauseVm()
    }, INACTIVITY_TIMEOUT_MS)
  }

  const loadStatus = async () => {
    if (!agentId) return

    try {
      const result = await axios.get(`/api/agent/vm?agentId=${agentId}`)
      const nextStatus = result.data.status ?? "inactive"
      setStatus(nextStatus)

      if (result.data.configured === false) {
        setStatus("unconfigured")
      }

      if (nextStatus === "active" && !streamUrl) {
        activateVm({ openFullscreen: false })
      }
    } catch (error: any) {
      setStatus("error")
      setMessage(error?.response?.data?.error ?? "Unable to load VM status.")
    }
  }

  const activateVm = async ({ openFullscreen = true } = {}) => {
    if (!agentId || isLoading) return

    clearIdleTimer()
    setIsLoading(true)
    setMessage(null)

    try {
      const result = await axios.post("/api/agent/vm", {
        agentId,
        action: "activate",
      })

      setStatus(result.data.status ?? "active")
      setStreamUrl(result.data.streamUrl)
      setIsOpen(openFullscreen)

      if (result.data.agentConfig) {
        setAgentConfig(result.data.agentConfig)
      }
    } catch (error: any) {
      setStatus(error?.response?.data?.configured === false ? "unconfigured" : "error")
      setMessage(error?.response?.data?.error ?? "Unable to activate VM desktop.")
    } finally {
      setIsLoading(false)
    }
  }

  const closeDesktop = () => {
    setIsOpen(false)
    scheduleIdlePause()
  }

  const openDesktop = () => {
    if (streamUrl && status === "active") {
      clearIdleTimer()
      setIsOpen(true)
      return
    }

    activateVm()
  }

  useEffect(() => {
    loadStatus()

    return clearIdleTimer
  }, [agentId])

  useEffect(() => {
    scheduleIdlePause()

    return clearIdleTimer
  }, [isOpen, status, agentId])

  const statusLabel =
    status === "active"
      ? "Active"
      : status === "paused"
        ? "Paused"
        : status === "unconfigured"
          ? "Setup needed"
          : status === "error"
            ? "Error"
            : "Inactive"

  const badgeVariant = status === "active" ? "default" : status === "error" ? "destructive" : "outline"

  return (
    <>
      <button
        type="button"
        onClick={openDesktop}
        className={cn(
          "group w-full overflow-hidden rounded-lg border bg-background text-left transition hover:border-primary/40 hover:bg-muted/30",
          isLoading && "cursor-wait"
        )}
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Monitor className="size-4" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">VM Desktop</p>
              <p className="truncate text-xs text-muted-foreground">
                {status === "active"
                  ? "Click preview to open full screen"
                  : hasSandbox
                    ? "Reconnect to this agent VM"
                    : "Click to activate this agent VM"}
              </p>
            </div>
          </div>
          <Badge variant={badgeVariant}>{statusLabel}</Badge>
        </div>
        <div className="relative h-36 overflow-hidden bg-[linear-gradient(135deg,var(--muted),var(--background))]">
          {streamUrl && status === "active" ? (
            <iframe
              title="Agent VM Desktop Preview"
              src={streamUrl}
              className="pointer-events-none h-full w-full border-0"
              tabIndex={-1}
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <>
              <div className="absolute inset-3 rounded-md border bg-background/80 shadow-sm">
                <div className="flex h-7 items-center gap-1.5 border-b px-2">
                  <span className="size-2 rounded-full bg-destructive/70" />
                  <span className="size-2 rounded-full bg-yellow-500/80" />
                  <span className="size-2 rounded-full bg-green-500/80" />
                </div>
                <div className="grid h-[calc(100%-1.75rem)] grid-cols-3 gap-2 p-2">
                  <span className="rounded-sm bg-muted" />
                  <span className="rounded-sm bg-muted/70" />
                  <span className="rounded-sm bg-muted" />
                  <span className="col-span-2 rounded-sm bg-muted/70" />
                  <span className="rounded-sm bg-muted" />
                </div>
              </div>
            </>
          )}
          {streamUrl && status === "active" ? (
            <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
              <Maximize2 className="size-3" />
              Open
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-background/65 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2 rounded-lg border bg-background/95 px-4 py-3 text-center shadow-sm">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {isLoading ? "Activating VM" : hasSandbox ? "Reactivate VM" : "Activate VM"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {hasSandbox ? "Resume this agent's desktop" : "Start this agent's desktop"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </button>

      {message && <p className="text-xs leading-5 text-destructive">{message}</p>}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">VM Desktop</p>
              <Badge variant={badgeVariant}>{statusLabel}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => activateVm()} disabled={isLoading}>
                {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                Reconnect
              </Button>
              <Button size="sm" variant="outline" onClick={pauseVm}>
                <Power className="size-4" />
                Pause
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={closeDesktop} aria-label="Close VM Desktop">
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-black">
            {streamUrl ? (
              <iframe
                title="Agent VM Desktop"
                src={streamUrl}
                className="h-full w-full border-0"
                allow="clipboard-read; clipboard-write; fullscreen"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {isLoading ? "Starting VM desktop..." : "Reactivate the VM desktop to continue."}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
