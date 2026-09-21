import type { AgentResponse } from "./agent-response-schema";

type ConversationMessage = {
    role: "user" | "agent" | "assistant";
    content: string;
    response?: AgentResponse;
};

export type ClarificationAnswer = {
    answer: string;
    questionIds: string[];
    questions: AgentResponse["questions"];
};

/**
 * Associates user follow-ups with the structured clarification immediately
 * before them. Keeping this association explicit prevents short answers such
 * as a channel name, email address, or time from being treated as a new topic.
 */
export function getClarificationAnswer(
    messages: ConversationMessage[],
    userMessageIndex: number
): ClarificationAnswer | null {
    const message = messages[userMessageIndex];
    if (message?.role !== "user"
        || typeof message.content !== "string"
        || !message.content.trim()) return null;

    for (let index = userMessageIndex - 1; index >= 0; index -= 1) {
        const candidate = messages[index];

        if (candidate.role === "user") continue;
        if (candidate.response?.type !== "clarification"
            || !Array.isArray(candidate.response.questions)
            || candidate.response.questions.length === 0) {
            return null;
        }

        const questions = candidate.response.questions;
        const normalizedAnswer = message.content.trim().toLowerCase();
        const optionMatches = questions.filter((question) =>
            question.options.some((option) => {
                const values = [option.label, option.value]
                    .map((value) => value.trim().toLowerCase())
                    .filter(Boolean);
                return values.some((value) =>
                    normalizedAnswer === value || normalizedAnswer.includes(value)
                );
            })
        );

        // A free-text reply unambiguously answers a single pending question.
        // For a multi-question prompt, only claim IDs whose options match.
        const answeredQuestions = questions.length === 1
            ? questions
            : optionMatches;

        return {
            answer: message.content.trim(),
            questionIds: answeredQuestions.map((question) => question.id),
            questions,
        };
    }

    return null;
}

export function getAnsweredClarificationIds(messages: ConversationMessage[]) {
    const answeredIds = new Set<string>();

    messages.forEach((message, index) => {
        if (message.role !== "user") return;
        const clarification = getClarificationAnswer(messages, index);
        clarification?.questionIds.forEach((id) => answeredIds.add(id));
    });

    return answeredIds;
}
