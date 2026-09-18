import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { agent } from "./agent-data"
import { AgentAvatar } from "./AgentAvatar"

export function ChatPanel() {
  return (
    <section className="flex min-h-[620px] min-w-0 flex-col bg-background lg:h-svh lg:min-h-0">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b px-5 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="relative">
            <AgentAvatar className="size-10" />
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
          </div>
          <div>
            <h1 className="font-semibold leading-tight">{agent.name}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Personal research agent</p>
          </div>
        </div>
        <button aria-checked="true" className="flex items-center gap-2.5 rounded-full border bg-muted/40 py-1.5 pl-2.5 pr-3" role="switch" type="button">
          <span className="relative flex h-4 w-7 items-center justify-end rounded-full bg-primary px-0.5"><span className="size-3 rounded-full bg-white shadow-sm" /></span>
          <span className="text-xs font-medium">Active</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
          <UserMessage>Can you help me prepare a quick brief for tomorrow&apos;s product planning meeting?</UserMessage>
          <AgentMessage time="10:32 AM">Absolutely. I can turn your notes into a concise brief with goals, open questions, key decisions, and a suggested agenda. Share whatever you have—even rough notes are fine.</AgentMessage>
          <UserMessage>Focus on the onboarding improvements and the Q4 launch timeline. Keep it under one page.</UserMessage>
          <AgentMessage time="10:34 AM">
            <div className="space-y-3">
              <p>Got it. I&apos;ll structure the brief around:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Current onboarding friction</li>
                <li>• Proposed improvements and expected impact</li>
                <li>• Q4 milestones, owners, and risks</li>
              </ul>
              <p>Send over the latest notes when you&apos;re ready.</p>
            </div>
          </AgentMessage>
        </div>
      </div>

      <div className="shrink-0 border-t bg-background px-5 py-4 sm:px-7">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border bg-background p-2 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
          <Textarea aria-label="Message Nova" className="min-h-10 max-h-28 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:border-0 focus-visible:ring-0" placeholder="Ask your agent anything..." />
          <Button aria-label="Send message" className="size-9 rounded-lg" size="icon"><Send className="size-4" /></Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{agent.name} can make mistakes. Check important information.</p>
      </div>
    </section>
  )
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end"><div className="max-w-[78%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground shadow-sm">{children}</div></div>
}

function AgentMessage({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <AgentAvatar className="mt-0.5 size-8" />
      <div className="max-w-[82%]">
        <div className="mb-1.5 flex items-center gap-2"><span className="text-sm font-semibold">{agent.name}</span><span className="text-xs text-muted-foreground">{time}</span></div>
        <div className="rounded-2xl rounded-tl-md border bg-muted/35 px-4 py-3 text-sm leading-6 text-foreground">{children}</div>
      </div>
    </div>
  )
}
