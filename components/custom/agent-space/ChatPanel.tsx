import { Loader, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { agent } from "./agent-data"
import { AgentAvatar } from "./AgentAvatar"
import { MessageType } from "@/type/Message"
import { useContext, useState } from "react"
import { useParams } from "next/navigation"
import axios from "axios"
import { toast } from "@/components/ui/toast"
import { AgentConfigContext } from "@/context/AgentConfigContext"

export function ChatPanel() {

  const [userInput, setUserInput] = useState('');
  const { agentId } = useParams();
  const [loading, setLoading] = useState(false);
  const { agentConfig, setAgentConfig } = useContext(AgentConfigContext);
  const [messages, setMessages] = useState<MessageType[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: `Hello! I am Agent, How can I help you today?`,
      time: new Date().toString()
    }
  ]);


  const handleMessageSend = async () => {

    if (!userInput.trim() || !agentId) {
      return;
    }
    setLoading(true);
    const userMsg: MessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
      time: new Date().toLocaleDateString()
    }

    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setUserInput('');


    try {
      const result = await axios.post('/api/agent/chat', {
        agentId: agentId,
        messages: updatedMsgs
      });

      console.log(result.data.response);
      const agentMsg: MessageType = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: result.data.response,
        time: new Date().toLocaleDateString()
      }
      setMessages((prev) => [...prev, agentMsg])
      setLoading(false)
    } catch (e) {
      toast.add({
        type: 'error',
        title: 'Internal server error'
      })
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
              >{msg.content}</AgentMessage>
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
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border bg-background p-2 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
          <Textarea aria-label="Message Nova" className="min-h-10 max-h-28 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:border-0 focus-visible:ring-0"
            placeholder="Ask your agent anything..."
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
