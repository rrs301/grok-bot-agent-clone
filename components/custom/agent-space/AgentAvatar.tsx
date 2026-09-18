import { Sparkles } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function AgentAvatar({ className = "size-10" }: { className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
        <Sparkles className="size-[42%]" />
      </AvatarFallback>
    </Avatar>
  )
}
