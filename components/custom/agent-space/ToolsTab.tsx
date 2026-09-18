import { Button } from "@/components/ui/button"
import { connectedTools } from "./agent-data"

export function ToolsTab() {
  return (
    <div>
      <div className="mb-5"><h3 className="font-semibold">Connected tools</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Give your agent access to the apps it needs.</p></div>
      <div className="divide-y rounded-xl border bg-background">
        {connectedTools.map((tool) => (
          <div className="flex items-center gap-3 p-3.5" key={tool.name}>
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tool.bg}`}><tool.icon className={`size-4.5 ${tool.color}`} /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{tool.name}</p><p className="truncate text-xs text-muted-foreground">{tool.description}</p></div>
            <Button size="sm" variant="outline">Connect</Button>
          </div>
        ))}
      </div>
    </div>
  )
}
