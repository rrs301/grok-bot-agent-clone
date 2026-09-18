import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { agent } from "./agent-data"
import { useContext } from "react"
import { AgentConfigContext } from "@/context/AgentConfigContext"

export function SettingsTab() {
  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="agent-instructions">Description &amp; Instructions</Label>
        <span className="text-xs text-muted-foreground">302 / 2,000</span>
      </div>
      <Textarea id="agent-instructions" className="min-h-72 resize-none bg-background leading-6"
        defaultValue={agentConfig?.description}
        onChange={(event) => setAgentConfig((prevConfig: any) => ({
          ...prevConfig,
          description: event.target.value
        }))}
      />
      <p className="text-xs leading-5 text-muted-foreground">Describe the agent&apos;s purpose, behavior, tone, and response preferences in one place.</p>
    </div>
  )
}
