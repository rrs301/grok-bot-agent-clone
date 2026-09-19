import type { MessageType } from "@/type/Message"
import { RoutineCard } from "./RoutineCard"

type AgentResponseViewProps = {
  message: MessageType
}

export function AgentResponseView({ message }: AgentResponseViewProps) {
  const response = message.response

  if (!response) {
    return <p className="whitespace-pre-wrap">{message.content}</p>
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap">{response.message}</p>
      {response.question && (
        <div className="space-y-2">
          <p className="font-medium">{response.question.question}</p>
          {response.question.options.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {response.question.options.map((option) => (
                <li key={option.id}>{option.label}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {response.routine && (
        <RoutineCard
          routine={response.routine}
          toolCards={message.toolCards ?? []}
        />
      )}
    </div>
  )
}
