"use client"

import { CalendarClock, History, Save, Settings2, Shuffle, SlidersHorizontal, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { agent } from "./agent-data"
import { AgentAvatar } from "./AgentAvatar"
import { AgentSettingsTab } from "./AgentSettingsTab"
import { ScheduleTab } from "./ScheduleTab"
import { SettingsTab } from "./SettingsTab"
import { ToolsTab } from "./ToolsTab"
import { RoutineExecutionHistoryTab } from "./RoutineExecutionHistoryTab"
import { useContext } from "react"
import { AgentConfigContext } from "@/context/AgentConfigContext"
import { toast } from "@/components/ui/toast"
import axios from "axios"

const tabs = [
  { value: "settings", label: "Settings", icon: Settings2 },
  { value: "tools", label: "Tools", icon: Wrench },
  { value: "schedule", label: "Schedule", icon: CalendarClock },
  { value: "routine-history", label: "Routine Execution History", icon: History },
  { value: "agent-settings", label: "Agent Settings", icon: SlidersHorizontal },
]

export function ConfigurationPanel() {

  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext)

  const shuffleAvatar = () => {
    const randomSeed = crypto.randomUUID()
    const newAvatarUrl = `https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=` + randomSeed
    setAgentConfig((prevConfig: any) => ({
      ...prevConfig,
      agentImage: newAvatarUrl,
    }));

  }


  const SaveAgentConfig = async () => {
    toast.add({
      title: "Saving Agent Configuration",
      description: "Your agent configuration is being saved.",
      type: "info",
    })
    const result = await axios.put('/api/agent', agentConfig);
    console.log(result.data);

    toast.add({
      title: "Agent Configuration Saved",
      description: "Your agent configuration has been saved successfully.",
      type: "success",
    })
  }

  return (
    <aside className="flex min-w-0 flex-col border-t bg-muted/25 lg:h-svh lg:w-[350px] lg:border-l lg:border-t-0 xl:w-[350px]">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b bg-background px-5">
        <div><h2 className="font-semibold">Agent Configuration</h2><p className="mt-0.5 text-xs text-muted-foreground">Customize how your agent works</p></div>
        <Button onClick={SaveAgentConfig}><Save className="size-4" />Save</Button>
      </header>
      <div className="overflow-y-auto">
        <div className="border-b bg-background p-5">
          <div className="flex items-center gap-4">
            <img src={agentConfig?.agentImage} alt="Agent Avatar" className="size-16 rounded-full" />
            <div><p className="text-sm font-medium">Agent avatar</p><p className="mt-0.5 text-xs text-muted-foreground">Give your agent a distinct look.</p>
              <Button onClick={shuffleAvatar} className="mt-2.5" size="sm" variant="outline">
                <Shuffle className="size-3.5" />Shuffle Avatar</Button></div>
          </div>
          <div className="mt-5 space-y-2"><Label htmlFor="agent-name">Agent Name</Label>
            <Input id="agent-name" className="h-9 bg-background"
              defaultValue={agentConfig?.name}
              onChange={(event) => setAgentConfig((prevConfig: any) => ({
                ...prevConfig,
                name: event.target.value
              }))}
            /></div>
        </div>
        <Tabs className="gap-0" defaultValue="settings">
          <TooltipProvider>
            <TabsList className="h-14 w-full justify-start gap-1 rounded-none border-b bg-background px-5" variant="line">
              {tabs.map((tab) => (
                <Tooltip key={tab.value}>
                  <TooltipTrigger render={<TabsTrigger aria-label={tab.label} className="h-9 max-w-12 px-3" value={tab.value} />}><tab.icon className="size-4" /></TooltipTrigger>
                  <TooltipContent>{tab.label}</TooltipContent>
                </Tooltip>
              ))}
            </TabsList>
          </TooltipProvider>
          <div className="p-5">
            <TabsContent value="settings"><SettingsTab /></TabsContent>
            <TabsContent value="tools"><ToolsTab /></TabsContent>
            <TabsContent value="schedule"><ScheduleTab /></TabsContent>
            <TabsContent value="routine-history"><RoutineExecutionHistoryTab /></TabsContent>
            <TabsContent value="agent-settings"><AgentSettingsTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </aside>
  )
}
