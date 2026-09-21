"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { ToolSuggestionCardData } from "@/type/Message"
import axios, { AxiosError } from "axios"
import { Check, Link2Off, Loader2, Plug, Unplug, Wrench } from "lucide-react"
import { useEffect, useState } from "react"

type ToolSuggestionCardProps = {
  agentId: string
  tool: ToolSuggestionCardData
  onConnectionChange: (slug: string, isConnected: boolean) => void
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const CONNECTION_TIMEOUT_MS = 2 * 60 * 1000
const STATUS_POLL_INTERVAL_MS = 1_500

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.error
    if (typeof message === "string") return message
  }

  return fallback
}

export function ToolSuggestionCard({
  agentId,
  tool,
  onConnectionChange,
}: ToolSuggestionCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isConnected, setIsConnected] = useState(tool.isConnected)

  useEffect(() => {
    setIsConnected(tool.isConnected)
  }, [tool.isConnected])

  const updateConnection = (connected: boolean) => {
    setIsConnected(connected)
    onConnectionChange(tool.slug, connected)
  }

  const status = !tool.isEnabled
    ? "Unavailable"
    : isConnected
      ? "Connected"
      : "Connection required"

  const getConnectionStatus = async () => {
    const response = await axios.get<{ isConnected: boolean }>("/api/tools/status", {
      params: {
        agentId,
        toolkitSlug: tool.slug,
      },
    })

    return response.data.isConnected
  }

  const connect = async () => {
    setIsUpdating(true)

    // Opening this synchronously from the click keeps browsers from treating the
    // authorization window as an unsolicited popup.
    const authorizationWindow = window.open(
      "",
      `connect-${tool.slug}`,
      "popup,width=560,height=720"
    )

    try {
      const response = await axios.post<{ redirectUrl: string }>("/api/tools/connect", {
        agentId,
        toolkitSlug: tool.slug,
      })

      if (!authorizationWindow) {
        window.location.assign(response.data.redirectUrl)
        return
      }

      authorizationWindow.location.assign(response.data.redirectUrl)
      authorizationWindow.focus()

      const startedAt = Date.now()
      while (Date.now() - startedAt < CONNECTION_TIMEOUT_MS) {
        await wait(STATUS_POLL_INTERVAL_MS)

        if (await getConnectionStatus()) {
          authorizationWindow.close()
          updateConnection(true)
          toast.add({
            title: `${tool.name} connected`,
            description: "Your account is ready for this agent to use.",
            type: "success",
          })
          return
        }

        if (authorizationWindow.closed) break
      }

      // The provider may activate the account immediately before its window closes.
      if (await getConnectionStatus()) {
        updateConnection(true)
        toast.add({
          title: `${tool.name} connected`,
          description: "Your account is ready for this agent to use.",
          type: "success",
        })
        return
      }

      toast.add({
        title: `Could not connect ${tool.name}`,
        description: authorizationWindow.closed
          ? "The authorization window was closed before the connection completed."
          : "The authorization request timed out. Please try again.",
        type: "warning",
      })
    } catch (error) {
      authorizationWindow?.close()
      toast.add({
        title: `Could not connect ${tool.name}`,
        description: getErrorMessage(error, "Unable to start the authorization flow."),
        type: "error",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const disconnect = async () => {
    setIsUpdating(true)

    try {
      await axios.post("/api/tools/disconnect", {
        agentId,
        toolkitSlug: tool.slug,
      })
      updateConnection(false)
      toast.add({
        title: `${tool.name} disconnected`,
        description: "This agent can no longer access the connected account.",
        type: "success",
      })
    } catch (error) {
      toast.add({
        title: `Could not disconnect ${tool.name}`,
        description: getErrorMessage(error, "Unable to disconnect the account."),
        type: "error",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <article className="rounded-xl border bg-background p-3.5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/50">
          {tool.icon ? (
            <img className="size-6 object-contain" src={tool.icon} alt="" />
          ) : (
            <Wrench className="size-4 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-medium leading-5">{tool.name}</h4>
            <Badge
              variant={isConnected ? "secondary" : "outline"}
              className={isConnected ? "text-emerald-700 dark:text-emerald-400" : undefined}
            >
              {isConnected ? <Check data-icon="inline-start" /> : <Link2Off data-icon="inline-start" />}
              {status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {tool.description}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Why this tool
        </p>
        <p className="mt-0.5 text-xs leading-5">{tool.reason}</p>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant={isConnected ? "outline" : "default"}
          disabled={!tool.isEnabled || isUpdating}
          onClick={isConnected ? disconnect : connect}
        >
          {isUpdating ? (
            <Loader2 className="animate-spin" />
          ) : isConnected ? (
            <Unplug />
          ) : (
            <Plug />
          )}
          {isUpdating
            ? isConnected
              ? "Disconnecting..."
              : "Connecting..."
            : isConnected
              ? "Disconnect"
              : "Connect"}
        </Button>
      </div>
    </article>
  )
}
