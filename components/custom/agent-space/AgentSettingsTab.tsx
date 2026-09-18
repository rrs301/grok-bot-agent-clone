import { ChevronRight, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { agentActions } from "./agent-data"

export function AgentSettingsTab() {
  return (
    <div className="space-y-7">
      <div><h3 className="font-semibold">Agent management</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">General options for this agent.</p></div>
      <div className="divide-y rounded-xl border bg-background">
        {agentActions.map((action) => (
          <Button className="h-auto w-full justify-start rounded-none border-0 bg-transparent px-4 py-3.5 text-left text-foreground shadow-none first:rounded-t-xl last:rounded-b-xl hover:bg-muted" key={action.name} variant="ghost">
            <action.icon className="mr-2 size-4 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{action.name}</span><span className="block text-xs font-normal text-muted-foreground">{action.description}</span></span><ChevronRight className="size-4 text-muted-foreground" />
          </Button>
        ))}
      </div>
      <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] p-4"><h3 className="text-sm font-semibold text-destructive">Danger Zone</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Permanently delete this agent and its conversation history.</p><Button className="mt-4" variant="destructive"><Trash2 className="size-4" />Delete Agent</Button></div>
    </div>
  )
}
