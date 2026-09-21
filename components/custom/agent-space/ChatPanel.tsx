import { Loader, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { agent } from "./agent-data"
import { AgentAvatar } from "./AgentAvatar"
import { MessageType } from "@/type/Message"
import type { RoutineEditEventDetail, SavedRoutine } from "@/type/Routine"
import { useContext, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import axios from "axios"
import { toast } from "@/components/ui/toast"
import { AgentConfigContext } from "@/context/AgentConfigContext"
import { AgentResponseView } from "./AgentResponseView"

export function ChatPanel() {

  const [userInput, setUserInput] = useState('');
  const { agentId } = useParams();
  const [loading, setLoading] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<SavedRoutine | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext);
  const getWelcomeMessages = (): MessageType[] => [
    {
      id: 'welcome',
      role: 'agent',
      content: `Hello! I am Agent, How can I help you today?`,
      time: new Date().toString()
    }
  ];
  const [messages, setMessages] = useState<MessageType[]>(getWelcomeMessages);

  useEffect(() => {
    if (!agentId) return

    let ignore = false
    axios
      .get<{ history: { messages: MessageType[] } | null }>('/api/agent/chat', {
        params: { agentId },
      })
      .then(({ data }) => {
        if (ignore) return
        const savedMessages = Array.isArray(data.history?.messages)
          ? data.history.messages
          : []
        setMessages(savedMessages.length > 0 ? savedMessages : getWelcomeMessages())
      })
      .catch(() => {
        if (!ignore) setMessages(getWelcomeMessages())
      })

    return () => {
      ignore = true
    }
  }, [agentId])

  useEffect(() => {
    const startRoutineEdit = (event: Event) => {
      const detail = (event as CustomEvent<RoutineEditEventDetail>).detail
      if (!detail || detail.agentId !== String(agentId)) return

      const routine = detail.routine
      setEditingRoutine(routine)
      setUserInput("")
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: [
            `I’m ready to edit **${routine.name}**.`,
            "",
            `- Goal: ${routine.goal}`,
            `- Instructions: ${routine.instructions}`,
            `- Schedule: ${routine.schedule.frequency} at ${routine.schedule.time} (${routine.schedule.timezone}), starting ${routine.schedule.startDate}`,
            routine.schedule.weekDays.length > 0
              ? `- Days: ${routine.schedule.weekDays.join(", ")}`
              : null,
            routine.tools.length > 0
              ? `- Tools: ${routine.tools.map((tool) => tool.name || tool.slug).join(", ")}`
              : "- Tools: None",
            "",
            "What would you like to change?",
          ].filter(Boolean).join("\n"),
          time: new Date().toISOString(),
          editingRoutineId: routine.id,
        },
      ])
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }

    window.addEventListener("routine-edit-requested", startRoutineEdit)
    return () => window.removeEventListener("routine-edit-requested", startRoutineEdit)
  }, [agentId])


  const handleMessageSend = async () => {
    const trimmedInput = userInput.trim();

    if (!trimmedInput || !agentId) {
      return;
    }

    setLoading(true);
    const userMsg: MessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedInput,
      time: new Date().toLocaleDateString()
    }

    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);

    try {
      const result = await axios.post('/api/agent/chat', {
        agentId: agentId,
        messages: updatedMsgs,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        editingRoutineId: editingRoutine?.id,
      });

      console.log(result.data.response);
      const agentMsg: MessageType = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: result.data.response?.message,
        response: result.data.response,
        toolCards: result.data?.toolCards,
        editingRoutineId: editingRoutine?.id,
        time: new Date().toLocaleDateString()
      }
      setMessages((prev) => [...prev, agentMsg])
      setUserInput('');
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? (typeof error.response?.data?.error === 'string' ? error.response.data.error : 'Please try again in a moment.')
        : 'Please try again in a moment.';

      toast.add({
        type: 'error',
        title: 'Unable to send message',
        description,
      })
      setUserInput(trimmedInput)
    } finally {
      setLoading(false)
    }
  }


  return (
    <section className="flex min-h-[620px] min-w-0 flex-col bg-background lg:h-svh lg:min-h-0">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b px-5 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={agentConfig?.agentImage} alt="agentImage"
              className="size-16 rounded-full" />
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
          </div>
          <div>
            <h1 className="font-semibold leading-tight">{agentConfig?.name}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{agentConfig?.description}</p>
          </div>
        </div>
        <button aria-checked="true" className="flex items-center gap-2.5 rounded-full border bg-muted/40 py-1.5 pl-2.5 pr-3" role="switch" type="button">
          <span className="relative flex h-4 w-7 items-center justify-end rounded-full bg-primary px-0.5"><span className="size-3 rounded-full bg-white shadow-sm" /></span>
          <span className="text-xs font-medium">Active</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
          {messages.map((msg, index) => (
            <div key={index}>
              {msg.role == 'agent' ? <AgentMessage time=""
                agentAvatar={agentConfig?.agentImage}
                agentName={agentConfig?.name}
              ><AgentResponseView
                  message={msg}
                  agentId={String(agentId)}
                  onSuggestedReply={setUserInput}
                  onRoutineSaved={(routineId) => {
                    if (routineId === editingRoutine?.id) setEditingRoutine(null)
                  }}
                  onWorkflowResult={(result) => {
                    if (!result.response) return
                    setMessages((current) => [...current, {
                      id: crypto.randomUUID(),
                      role: "agent",
                      content: result.response?.message ?? "",
                      response: result.response,
                      toolCards: result.toolCards ?? [],
                      time: new Date().toISOString(),
                    }])
                  }}
                /></AgentMessage>
                : <UserMessage>{msg.content}</UserMessage>}
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-3 animate-in fade-in-50 duration-300">
              <img src={agentConfig?.agentImage} alt="avatar" className="size-12 rounded-full" />

              <div className="max-w-[82%]">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-sm font-semibold">{agentConfig?.name}</span>
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
                <div className="rounded-2xl rounded-tl-md border bg-muted/35 px-4 py-3 text-sm leading-6 flex items-center gap-2 text-muted-foreground shadow-sm">
                  <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-2 rounded-full bg-primary animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>



      <div className="shrink-0 border-t bg-background px-5 py-4 sm:px-7">
        {editingRoutine && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-2 text-xs">
            <span className="truncate">
              Editing <strong>{editingRoutine.name}</strong>
            </span>
            <Button
              aria-label="Cancel routine edit"
              className="size-7 shrink-0"
              onClick={() => setEditingRoutine(null)}
              size="icon"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border bg-background p-2 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
          <Textarea aria-label="Message Nova" className="min-h-10 max-h-28 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:border-0 focus-visible:ring-0"
            ref={inputRef}
            placeholder={editingRoutine ? "Describe the changes to this routine..." : "Ask your agent anything..."}
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
          />
          <Button aria-label="Send message" onClick={handleMessageSend}
            className="size-9 rounded-lg" size="icon"
            disabled={loading}
          >
            {loading ? <Loader className="animate-spin" /> : <Send className="size-4" />}</Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{agent.name} can make mistakes. Check important information.</p>
      </div>
    </section>
  )
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end"><div className="max-w-[78%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground shadow-sm">{children}</div></div>
}

function AgentMessage({ children, time, agentAvatar, agentName }: { children: React.ReactNode; time: string, agentAvatar: string, agentName: string }) {
  return (
    <div className="flex items-start gap-3">
      <img src={agentAvatar} alt="avatar" className="size-12 rounded-full" />
      <div className="max-w-[82%]">
        <div className="mb-1.5 flex items-center gap-2"><span className="text-sm font-semibold">{agentName}</span><span className="text-xs text-muted-foreground">{time}</span></div>
        <div className="rounded-2xl rounded-tl-md border bg-muted/35 px-4 py-3 text-sm leading-6 text-foreground">{children}</div>
      </div>
    </div>
  )
}

