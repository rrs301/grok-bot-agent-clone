"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { ToolSuggestionCardData } from "@/type/Message"
import axios from "axios"
import { Check, Link2Off, Loader2, Plug, Unplug, Wrench } from "lucide-react"
import { useState } from "react"

type ToolSuggestionCardProps = {
  agentId: string
  tool: ToolSuggestionCardData
  onConnectionChange: (slug: string, isConnected: boolean) => void
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export function ToolSuggestionCard({
  agentId,
  tool,
  onConnectionChange,
}: ToolSuggestionCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const status = !tool.isEnabled
    ? "Unavailable"
    : tool.isConnected
      ? "Connected"
      : "Connection required"



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
              variant={tool.isConnected ? "secondary" : "outline"}
              className={tool.isConnected ? "text-emerald-700 dark:text-emerald-400" : undefined}
            >
              {tool.isConnected ? <Check data-icon="inline-start" /> : <Link2Off data-icon="inline-start" />}
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
          variant={tool.isConnected ? "outline" : "default"}
          disabled={!tool.isEnabled || isUpdating}
        // onClick={tool.isConnected ? disconnect : connect}
        >
          {isUpdating ? (
            <Loader2 className="animate-spin" />
          ) : tool.isConnected ? (
            <Unplug />
          ) : (
            <Plug />
          )}
          {isUpdating
            ? tool.isConnected
              ? "Disconnecting..."
              : "Connecting..."
            : tool.isConnected
              ? "Disconnect"
              : "Connect"}
        </Button>
      </div>
    </article>
  )
}
