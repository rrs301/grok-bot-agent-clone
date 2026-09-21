"use client"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import type { MessageType } from "@/type/Message"
import axios from "axios"
import { Check, Loader2, ShieldCheck, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useState } from "react"
import { RoutineCard } from "./RoutineCard"
import { ToolSuggestionCard } from "./ToolSuggestionCard"

type AgentResponseViewProps = {
  message: MessageType
  agentId: string
  onSuggestedReply?: (value: string) => void
  onWorkflowResult?: (result: { response: MessageType["response"], toolCards?: MessageType["toolCards"] }) => void
  onRoutineSaved?: (routineId?: string) => void
}

export function AgentResponseView({
  message,
  agentId,
  onSuggestedReply,
  onWorkflowResult,
  onRoutineSaved,
}: AgentResponseViewProps) {
  const response = message.response

  if (!response) {
    return <MarkdownMessage>{message.content}</MarkdownMessage>
  }

  return (
    <div className="space-y-3">
      <MarkdownMessage>{response.message}</MarkdownMessage>
      {response.questions.length > 0 && (
        <div className="space-y-2">
          <ul className="list-disc space-y-1 pl-5">
            {response.questions.map((question) => (
              <li key={question.id}>
                {question.question}
                {question.options.length > 0 && (
                  <div className="mt-2 grid gap-2">
                    {question.options.map((option) => (
                      <Button
                        className="h-auto justify-start whitespace-normal py-2 text-left"
                        key={option.value}
                        onClick={() => onSuggestedReply?.(option.value)}
                        variant="outline"
                      >
                        <span>
                          <span className="block font-medium">{option.label}</span>
                          {option.description && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {option.description}
                            </span>
                          )}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {response?.suggestedTools?.map((tool, index) => (
        <div key={`${tool.slug}-${index}`}>
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
          routineId={message.editingRoutineId}
          onSaved={() => onRoutineSaved?.(message.editingRoutineId)}
        />
      )}
      {response.confirmation && (
        <ConfirmationCard
          confirmation={response.confirmation}
          onResult={onWorkflowResult}
        />
      )}
    </div>
  )
}

function ConfirmationCard({
  confirmation,
  onResult,
}: {
  confirmation: NonNullable<NonNullable<MessageType["response"]>["confirmation"]>
  onResult?: AgentResponseViewProps["onWorkflowResult"]
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null)

  const decide = async (approved: boolean) => {
    setIsSubmitting(true)
    try {
      const { data } = await axios.post("/api/agent/workflows", {
        workflowId: confirmation.workflowId,
        approved,
      })
      setDecision(approved ? "approved" : "rejected")
      onResult?.(data)
    } catch {
      toast.add({
        title: "Unable to process confirmation",
        description: "The action was not executed. Please try again.",
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border border-amber-300/70 bg-amber-50/60 p-3.5 dark:border-amber-700/60 dark:bg-amber-950/20">
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <div>
          <p className="text-sm font-semibold">{confirmation.title}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {confirmation.description}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {confirmation.actions.map((action, index) => (
          <div className="rounded-lg border bg-background/80 px-3 py-2" key={`${action.tool}-${index}`}>
            <p className="text-xs font-medium">{action.tool}</p>
            <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
              {action.summary}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {decision ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {decision === "approved" ? <Check className="size-4" /> : <X className="size-4" />}
            {decision === "approved" ? "Approved" : "Cancelled"}
          </span>
        ) : (
          <>
            <Button
              disabled={isSubmitting}
              onClick={() => decide(false)}
              size="sm"
              variant="outline"
            >
              <X /> Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => decide(true)}
              size="sm"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Check />}
              Confirm
            </Button>
          </>
        )}
      </div>
    </section>
  )
}

function MarkdownMessage({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1.5 mt-3 font-semibold first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="my-2 leading-6 first:mt-0 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>,
        a: ({ children, href }) => <a className="font-medium text-primary underline underline-offset-4" href={href} target="_blank" rel="noreferrer">{children}</a>,
        code: ({ children, className }) => className ? (
          <code className={className}>{children}</code>
        ) : (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
        ),
        pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">{children}</pre>,
        table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
        th: ({ children }) => <th className="border px-2 py-1.5 font-semibold">{children}</th>,
        td: ({ children }) => <td className="border px-2 py-1.5 align-top">{children}</td>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
