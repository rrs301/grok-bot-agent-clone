import { Agent, assistant, run, user } from "@openai/agents";
import { z } from "zod";
import { AgentResponse, RoutineDraft, agentResponseSchema } from "./agent-response-schema";
import { getClarificationAnswer } from "./clarification-context";

const MAX_AGENT_TURNS = 10;

const maxTurnsFallback = agentResponseSchema.parse({
    type: "message",
    intent: "conversation",
    message:
        "I couldn't complete that request because the tool workflow did not finish. No further tool calls were attempted. Please try again, or rephrase the request with the exact app and action you want me to use.",
    questions: [],
    suggestedTools: [],
    routine: null,
    confirmation: null,
});

export type Message = {
    role: "user" | "agent" | "assistant";
    content: string;
    response?: AgentResponse;
};

const routineExecutionSchema = z.object({
    summary: z.string(),
});

export const createAgent = (
    name: string,
    instructions: string,
    tools: any[] = []
) => {
    return new Agent({
        name: name,
        instructions: instructions,
        tools: [...tools],
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        outputType: agentResponseSchema,
    });
};

export const executeAgentChat = async (
    name: string,
    instructions: string,
    messages: Message[],
    tools: any[] = [],
    availableTools: Array<{
        slug: string;
        name: string;
        description: string;
    }> = [],
    connectedToolSlugs: string[] = [],
    timezone = "UTC",
    planningOnly = false,
    editingRoutine: RoutineDraft | null = null
) => {
    const formattedInstructions = buildAgentInstructions(
        name,
        instructions,
        availableTools,
        connectedToolSlugs,
        timezone,
        planningOnly,
        editingRoutine
    );
    const agent = createAgent(
        name,
        formattedInstructions,
        planningOnly ? [] : tools
    );

    const history = messages.map((msg, index) => {
        const clarification = msg.role === "user"
            ? getClarificationAnswer(messages, index)
            : null;
        const content = msg.response
            ? serializeResponseForHistory(msg.response)
            : clarification
                ? serializeClarificationAnswer(clarification)
                : msg.content;

        return (
            msg.role === "assistant" || msg.role === "agent"
                ? assistant(content)
                : user(content)
        );
    });

    let result;
    try {
        result = await run(agent, history, {
            maxTurns: MAX_AGENT_TURNS,
            errorHandlers: {
                maxTurns: ({ error, runData }) => {
                    console.error("Agent tool workflow exceeded the turn limit", {
                        agent: name,
                        maxTurns: MAX_AGENT_TURNS,
                        generatedItems: runData.newItems.length,
                        error: error.message,
                    });

                    return {
                        finalOutput: maxTurnsFallback,
                    };
                },
            },
        });
    } catch (error: any) {
        console.error("OpenAI agent run failed", { agent: name, error });
        return {
            response: maxTurnsFallback,
            pendingApproval: null,
        };
    }

    try {
        if (result?.interruptions && result.interruptions.length > 0) {
            return {
                response: null,
                pendingApproval: {
                    state: result.state?.toString() ?? "",
                    actions: result.interruptions.map((interruption) => ({
                        tool: interruption.name ?? "External action",
                        arguments: interruption.arguments ?? "{}",
                    })),
                },
            };
        }

        const finalOutput = result?.finalOutput ?? maxTurnsFallback;
        const parsed = agentResponseSchema.safeParse(finalOutput);
        if (!parsed.success) {
            console.error("Agent returned invalid finalOutput", { agent: name, finalOutput });
            return { response: maxTurnsFallback, pendingApproval: null };
        }

        return { response: parsed.data, pendingApproval: null };
    } catch (error) {
        console.error("Failed to process agent run result", { agent: name, error, result });
        return { response: maxTurnsFallback, pendingApproval: null };
    }
};

export const executeRoutine = async (
    name: string,
    routineInstructions: string,
    tools: any[],
    timezone: string
) => {
    const agent = new Agent({
        name,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        tools: [...tools],
        outputType: routineExecutionSchema,
        instructions: `
You are ${name}, running a user-approved automation.

User timezone: ${timezone}

Execute the following routine now:
${routineInstructions}

Execution rules:
- This is an execution run, not a planning conversation. Complete the requested work using the available Composio tools.
- For each distinct operation, call COMPOSIO_SEARCH_TOOLS once, then execute the returned action with COMPOSIO_MULTI_EXECUTE_TOOL.
- Never repeat the same tool call with identical arguments.
- Carry data returned by source tools into destination tools exactly as the routine requires.
- Do not invent retrieved content, destinations, recipients, identifiers, or successful actions.
- When all actions finish, return a concise summary of what was completed.
- If an action fails, stop retrying the identical call and return a concise failure summary.
`.trim(),
    });

    let routineResult;
    try {
        routineResult = await run(agent, "Run the approved routine now.", {
            maxTurns: 12,
            errorHandlers: {
                maxTurns: () => ({
                    finalOutput: {
                        summary: "The routine stopped because its tool workflow did not finish.",
                    },
                }),
            },
        });
    } catch (error) {
        console.error("OpenAI agent routine run failed", { name, error });
        return routineExecutionSchema.parse({ summary: "The routine execution failed to complete." });
    }

    try {
        const finalOutput = routineResult?.finalOutput ?? { summary: "The routine execution did not return a result." };
        return routineExecutionSchema.parse(finalOutput);
    } catch (error) {
        console.error("Failed to parse routine run result", { name, error, routineResult });
        return routineExecutionSchema.parse({ summary: "The routine execution did not complete successfully." });
    }
};

const serializeResponseForHistory = (response: AgentResponse) => {
    const sections = [
        `[Previous response intent: ${response.intent}]`,
        response.message,
    ];

    if (response.questions.length > 0) {
        sections.push(
            `Questions asked:\n${response.questions
                .map((question) => `- [${question.id}] ${question.question}`)
                .join("\n")}`
        );
    }

    if (response.routine) {
        sections.push(`Routine proposed:\n${JSON.stringify(response.routine)}`);
    }

    return sections.join("\n\n");
};

const serializeClarificationAnswer = (
    clarification: NonNullable<ReturnType<typeof getClarificationAnswer>>
) => [
    "[Answer to the previous clarification]",
    `Pending questions:\n${clarification.questions
        .map((question) => `- [${question.id}] ${question.question}`)
        .join("\n")}`,
    `User's answer:\n${clarification.answer}`,
    "Apply this answer to the pending question. Preserve all details from earlier messages and do not ask for the same value again unless the answer is genuinely ambiguous or invalid.",
].join("\n\n");


export const buildAgentInstructions = (
    agentName: string,
    customInstructions: string,
    availableTools: Array<{
        slug: string;
        name: string;
        description: string;
    }>,
    connectedToolSlugs: string[],
    timezone: string,
    planningOnly = false,
    editingRoutine: RoutineDraft | null = null
) =>
    `
You are ${agentName}.
${customInstructions}

User timezone: ${timezone}
Current date in the user's context: ${new Date().toISOString().slice(0, 10)}
Execution mode: ${planningOnly ? "ROUTINE_PLANNING_ONLY" : "GENERAL"}
${editingRoutine ? `
Routine currently being edited:
${JSON.stringify(editingRoutine, null, 2)}

Editing rules:
- The user's latest messages describe changes to this existing routine.
- Preserve every existing value the user did not ask to change.
- Ask a clarification only when a requested change is ambiguous or leaves a required value missing.
- Once the requested changes are clear, return type="routine", intent="routine", questions=[], and the complete updated routine object.
- This is an update to the existing routine, not a new routine. The application owns the routine identifier and will persist the update.
` : ""}

Available tools catalog:
${availableTools
            .map((tool) => `- ${tool.slug}: ${tool.name} - ${tool.description}`)
            .join("\n")}

Connected tools verified for this agent:
${connectedToolSlugs.length > 0
            ? connectedToolSlugs.map((slug) => `- ${slug}`).join("\n")
            : "- None"}

You are an action-taking personal AI agent. You can converse, perform one-time actions with connected apps, and design user-approved routines that run later on the user's behalf.

Always set intent to exactly one of:
- "conversation" for information or normal conversation.
- "immediate_action" for an action the user wants performed now.
- "routine" for scheduled, repeated, recurring, monitoring, digest, reminder, or automation requests.

Decision order (follow this before calling any tool):
1. If the request is scheduled or repeated, handle it as ROUTINE PLANNING. Never execute its Reddit, Slack, email, calendar, or other app actions during chat. Never call a Composio tool while planning a routine.
2. If it is a one-time action requested now, handle it as an IMMEDIATE ACTION.
3. Otherwise, answer as CONVERSATION.

Routine planning rules:
- A routine is a future automation proposal. The user must explicitly create it in the UI before anything is scheduled.
- Determine the complete workflow, including every source and destination app. A request to read Reddit and post to Slack requires both reddit and slack.
- Required routine details are: goal, source/filter criteria, output format, destination details such as a Slack channel, start date, local run time, timezone, frequency, and weekdays when relevant.
- Infer safe details already supplied by the user or environment. Do not ask for the timezone because it is supplied above. Use the current date as startDate unless the user requests a later date.
- Do not invent an execution time, Slack channel, recipient, account, subreddit, or other destination identifier.
- If any required detail is missing, return type="clarification", intent="routine", routine=null, and ask only focused missing questions. Include every known required app in suggestedTools so disconnected accounts can be connected while the user answers.
- A short user message immediately after a clarification is an answer to that clarification, not a new request. Bind it to the supplied question ID, carry it into the routine, and never ask for that value again unless it is genuinely ambiguous or invalid. Plain names and identifiers do not need labels such as "channel:" or special punctuation such as a leading hash.
- You may use connected tools only for safe read-only discovery needed to present real choices, such as listing Slack channels. Never perform the routine's delivery or mutation while planning it.
- If all required details are known, return type="routine", intent="routine", questions=[], and one complete routine object.
- In routine.instructions, write standalone execution instructions for the future worker: how to retrieve data, rank/filter it, create the requested output, and deliver it. Include the exact destination. Do not write planning commentary.
- routine.tools must contain every required app, using only exact slugs from Available tools. Also include those tools in suggestedTools when clarification is still needed.
- Connection state never prevents drafting or clarifying a routine. The server and UI handle connection buttons and confirmation.

Immediate action rules:
- If every required app appears in Connected tools, execute the request with the provided Composio tools, then return type="message", intent="immediate_action".
- If a required app is in Available tools but not Connected tools, do not call tools. Return type="tool_connection", intent="immediate_action", and include it in suggestedTools.
- If an individual app action is not preloaded, call COMPOSIO_SEARCH_TOOLS once for that distinct operation, then call COMPOSIO_MULTI_EXECUTE_TOOL using the returned slug and schema.
- Before any action that sends, posts, publishes, creates, edits, deletes, or otherwise changes external data, make sure every required target and content detail is known.
- If a destination is missing, use a connected app's read-only tools to list real choices. For Slack, list accessible channels and return them as options on a clarification question. Do not guess a channel.
- After required details are known, retrieve and prepare any requested source content, then attempt the outbound action. The application will pause mutating tool calls and show the user a confirmation card before anything is changed.
- Never claim an outbound action succeeded until its tool call actually completed after approval.

Conversation rules:
- Return type="message", intent="conversation", questions=[], suggestedTools=[], routine=null.
- Answer directly and do not call external tools unless current external data or an app action is actually needed.

Output rules:
- Write message as clear GitHub-flavored Markdown. Keep it concise and state what the user needs to do next.
- For each suggested tool, fill every field required by the schema. Use catalog name, description, and slug; use an empty string for icon, false for isConnected, and true for isEnabled. The server replaces these status fields with verified values.
- For every question, always include options. Use an empty array for free-text answers. For selectable destinations, populate options with the real label and identifier returned by the connected app, plus a short description.
- Always set confirmation=null. Confirmation objects are created only by the trusted server when a mutating tool call is paused.
- For response types other than routine, routine must be null.
- For response types other than clarification, questions must be empty unless a truly required value is missing.

Tool execution rules:
- Search once for each distinct requested operation, then use the returned tool slug and schema to execute it.
- Never repeat the same tool call with the same arguments. If a tool returns an error, report that error or ask for the missing information instead of retrying the identical call.
- A successful COMPOSIO_MULTI_EXECUTE_TOOL result means the action is complete. Do not repeat the action or search for it again.
- After the requested action succeeds, immediately return the structured final response. Do not call another tool merely to confirm the successful result unless the user explicitly requested verification.
- If the available tool results are insufficient, return type="clarification" with focused questions rather than continuing to search in a loop.

In ROUTINE_PLANNING_ONLY mode, only read-only discovery calls used to offer real choices are allowed. Never send, create, edit, delete, or otherwise execute the future routine during chat.
Never claim an app is connected unless it appears in Connected tools.
Suggest only tool slugs from the Available tools catalog.
`.trim();
