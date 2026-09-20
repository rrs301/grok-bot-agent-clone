import type { MessageType } from "@/type/Message"
import { RoutineCard } from "./RoutineCard"
import { ToolSuggestionCard } from "./ToolSuggestionCard"

type AgentResponseViewProps = {
  message: MessageType
  agentId: string
}

export function AgentResponseView({ message, agentId }: AgentResponseViewProps) {
  const response = message.response

  if (!response) {
    return <p className="whitespace-pre-wrap">{message.content}</p>
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap">{response.message}</p>
      {response.questions.length > 0 && (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-5">
            {response.questions.map((question) => (
              <li key={question.id}>{question.question}</li>
            ))}
          </ul>
        </div>
      )}
      {response?.suggestedTools?.map((tool, index) => (
        <div>
          <ToolSuggestionCard agentId={agentId} onConnectionChange={() => console.log("CONNECTION")}
            tool={tool}
          />
        </div>
      ))}
      {response.routine && (
        <RoutineCard
          agentId={agentId}
          routine={response.routine}
          toolCards={message.toolCards ?? []}
        />
      )}
    </div>
  )
}
