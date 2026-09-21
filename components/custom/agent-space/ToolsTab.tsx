"use client"

import type { ToolSuggestionCardData } from "@/type/Message"
import axios from "axios"
import { Loader2 } from "lucide-react"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ToolSuggestionCard } from "./ToolSuggestionCard"

export function ToolsTab() {
  const { agentId } = useParams<{ agentId: string }>()
  const [tools, setTools] = useState<ToolSuggestionCardData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!agentId) return

    let isMounted = true
    axios
      .get<{ tools: ToolSuggestionCardData[] }>("/api/tools/status", {
        params: { agentId },
      })
      .then(({ data }) => {
        if (isMounted) setTools(data.tools)
      })
      .catch(() => {
        if (isMounted) setTools([])
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [agentId])

  const updateConnection = (slug: string, isConnected: boolean) => {
    setTools((current) => {
      if (isConnected) return current

      return current.filter((tool) => tool.slug.toLowerCase() !== slug.toLowerCase())
    })
  }

  const connectedTools = tools.filter((tool) => tool.isConnected)

  return (
    <div>
      <div className="mb-5">
        <h3 className="font-semibold">Connected tools</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Connected accounts are automatically available to this agent.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center rounded-xl border p-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : connectedTools.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          No connected tools yet. Connect tools from the agent flow when you need them.
        </div>
      ) : (
        <div className="space-y-2.5">
          {connectedTools.map((tool) => (
            <ToolSuggestionCard
              key={tool.slug}
              agentId={agentId}
              tool={tool}
              onConnectionChange={updateConnection}
            />
          ))}
        </div>
      )}
    </div>
  )
}
