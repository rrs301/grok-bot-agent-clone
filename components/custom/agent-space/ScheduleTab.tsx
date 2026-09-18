import { CalendarClock, ChevronRight, Clock3 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ScheduleTab() {
  return (
    <div className="space-y-6">
      <div><h3 className="font-semibold">Execution schedule</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose when this agent should run.</p></div>
      <div className="grid grid-cols-3 gap-2">
        {[["Manual", "On demand"], ["Recurring", "Repeats"], ["Specific Time", "One time"]].map(([title, caption], index) => (
          <div className={`rounded-xl border p-3 ${index === 1 ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-background"}`} key={title}>
            <div className="mb-3 flex items-center justify-between"><Clock3 className={index === 1 ? "size-4 text-primary" : "size-4 text-muted-foreground"} /><span className={`size-3 rounded-full border-[3px] ${index === 1 ? "border-primary bg-background" : "border-muted-foreground/30"}`} /></div>
            <p className="text-xs font-semibold">{title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{caption}</p>
          </div>
        ))}
      </div>
      <div className="space-y-4 rounded-xl border bg-background p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Frequency</Label><div className="flex h-9 items-center justify-between rounded-lg border px-3 text-sm">Every day <ChevronRight className="size-3.5 rotate-90 text-muted-foreground" /></div></div>
          <div className="space-y-2"><Label htmlFor="schedule-time">Time</Label><Input id="schedule-time" defaultValue="8:00 AM" /></div>
        </div>
        <div className="space-y-2"><Label>Days</Label><div className="flex justify-between gap-1">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span className={`flex size-8 items-center justify-center rounded-full text-xs font-medium ${index < 5 ? "bg-primary text-primary-foreground" : "border bg-background text-muted-foreground"}`} key={`${day}-${index}`}>{day}</span>)}</div></div>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-primary/7 p-4 text-primary"><CalendarClock className="size-5 shrink-0" /><div><p className="text-xs font-medium uppercase tracking-wider opacity-70">Next run</p><p className="mt-0.5 text-sm font-semibold">Every weekday at 8:00 AM</p></div></div>
    </div>
  )
}
