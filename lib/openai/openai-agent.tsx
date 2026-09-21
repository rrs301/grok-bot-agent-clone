import { Agent, assistant, run, user } from "@openai/agents";
import { z } from "zod";
import { createDesktopComputerTool } from "@/lib/e2b/agent-computer";
import { AgentResponse, RoutineDraft, agentResponseSchema } from "./agent-response-schema";
import { getClarificationAnswer } from "./clarification-context";

const MAX_AGENT_TURNS = 10;
const MAX_COMPUTER_AGENT_TURNS = 50;

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

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function isComputerModelAccessError(message: string) {
    return /model [`'"]?[\w.-]+[`'"]?.*(does not exist|do not have access)|404.*model/i
        .test(message);
}

function createDesktopRunFailureResponse(detail: string) {
    const message = isComputerModelAccessError(detail)
        ? [
            "The VM desktop tool is connected, but this OpenAI project does not have access to the computer-use model required to drive it.",
            "",
            `Error: ${detail}`,
            "",
            "Set `OPENAI_COMPUTER_MODEL` to a computer-use capable model your project can access. Until that model is available, the agent cannot autonomously operate the E2B desktop.",
        ].join("\n")
        : [
            "I tried to use the VM desktop, but the desktop-enabled agent run failed before it could finish.",
            "",
            `Error: ${detail}`,
            "",
            "If the VM is showing login, captcha, MFA, or a browser consent screen, open the VM desktop, complete that step, then ask me to continue.",
        ].join("\n");

    return agentResponseSchema.parse({
        ...maxTurnsFallback,
        intent: "immediate_action",
        message,
    });
}

export type Message = {
    role: "user" | "agent" | "assistant";
    content: string;
    response?: AgentResponse;
};

const routineExecutionSchema = z.object({
    status: z.enum(["completed", "failed"]),
    summary: z.string(),
    error: z.string().nullable().default(null),
});

type VmDesktopContext = {
    agentId: string;
    userEmail: string;
};

function toolsetNeedsComputerModel(tools: any[]) {
    return tools.some((tool) => tool?.type === "computer");
}

function getModelForTools(tools: any[]) {
    if (toolsetNeedsComputerModel(tools)) {
        return process.env.OPENAI_COMPUTER_MODEL || "gpt-5.6-luna";
    }

    return process.env.OPENAI_MODEL || "gpt-5.4-mini";
}

export const createAgent = (
    name: string,
    instructions: string,
    tools: any[] = [],
    outputType: typeof agentResponseSchema | "text" = agentResponseSchema
) => {
    return new Agent({
        name: name,
        instructions: instructions,
        tools: [...tools],
        model: getModelForTools(tools),
        outputType,
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
    editingRoutine: RoutineDraft | null = null,
    vmDesktopContext: VmDesktopContext | null = null
) => {
    const desktopTool = !planningOnly && vmDesktopContext
        ? createDesktopComputerTool(vmDesktopContext)
        : null;
    const runtimeTools = desktopTool ? [...tools, desktopTool] : tools;
    const formattedInstructions = buildAgentInstructions(
        name,
        instructions,
        availableTools,
        connectedToolSlugs,
        timezone,
        planningOnly,
        editingRoutine,
        Boolean(desktopTool)
    );
    const agent = createAgent(
        name,
        formattedInstructions,
        planningOnly ? [] : runtimeTools,
        desktopTool ? "text" : agentResponseSchema
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
            maxTurns: desktopTool ? MAX_COMPUTER_AGENT_TURNS : MAX_AGENT_TURNS,
            errorHandlers: {
                maxTurns: ({ error, runData }) => {
                    console.error("Agent tool workflow exceeded the turn limit", {
                        agent: name,
                        maxTurns: desktopTool ? MAX_COMPUTER_AGENT_TURNS : MAX_AGENT_TURNS,
                        vmDesktopEnabled: Boolean(desktopTool),
                        generatedItems: runData.newItems.length,
                        error: error.message,
                    });

                    return {
                        finalOutput: desktopTool
                            ? agentResponseSchema.parse({
                                ...maxTurnsFallback,
                                intent: "immediate_action",
                                message:
                                    "I opened the VM desktop path, but the browser workflow took too many steps and I had to stop. If the VM is on a login, captcha, MFA, or consent screen, please open the VM desktop, complete that step, then ask me to continue.",
                            })
                            : maxTurnsFallback,
                    };
                },
            },
        });
    } catch (error: any) {
        console.error("OpenAI agent run failed", { agent: name, error });
        const detail = errorMessage(error);
        return {
            response: desktopTool
                ? createDesktopRunFailureResponse(detail)
                : maxTurnsFallback,
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
        if (desktopTool && typeof finalOutput === "string") {
            return {
                response: agentResponseSchema.parse({
                    type: "message",
                    intent: "immediate_action",
                    message: finalOutput,
                    questions: [],
                    suggestedTools: [],
                    routine: null,
                    confirmation: null,
                }),
                pendingApproval: null,
            };
        }

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
    timezone: string,
    vmDesktopContext: VmDesktopContext | null = null
) => {
    const desktopTool = vmDesktopContext
        ? createDesktopComputerTool(vmDesktopContext)
        : null;
    const runtimeTools = desktopTool ? [...tools, desktopTool] : tools;
    const agent = new Agent({
        name,
        model: getModelForTools(runtimeTools),
        tools: runtimeTools,
        outputType: routineExecutionSchema,
        instructions: `
You are ${name}, running a user-approved automation.

User timezone: ${timezone}
VM desktop availability: ${desktopTool ? "available" : "unavailable"}

Execute the following routine now:
${routineInstructions}

Execution rules:
- This is an execution run, not a planning conversation. Complete the requested work using the available Composio tools and, when needed, the VM desktop.
- Use the VM desktop for website/browser tasks when no connected app tool can directly perform the work, when the user explicitly requested browser/desktop use, or when visual interaction with a page is required.
- When using the VM desktop, open or reuse Chrome, navigate to the required website, inspect the page, and return a faithful summary with source/site details.
- If the website blocks progress with a login, paywall, captcha, MFA, cookie wall that cannot be accepted safely, or missing credentials, stop and return status="failed" with a clear message asking the user to open the VM desktop and sign in. Do not ask for credentials in chat and do not invent inaccessible content.
- The VM desktop session persists across pauses/inactivity and will resume from the last state when reconnected.
- When using connected app tools, call COMPOSIO_SEARCH_TOOLS for each distinct operation with a precise use case that preserves the requested action (for example, "post a new message to a Slack channel", not merely "send a Slack message"). Use the returned primary tool that matches that action.
- When using connected app tools, review the complete input schema before execution. If the search result provides only a schemaRef, call COMPOSIO_GET_TOOL_SCHEMAS before COMPOSIO_MULTI_EXECUTE_TOOL. Include every required field using the exact schema field names.
- Pass the workflow session_id returned by COMPOSIO_SEARCH_TOOLS to every subsequent Composio meta-tool call for that connected app workflow.
- For a new top-level Slack channel post, use SLACK_SEND_MESSAGE with channel and markdown_text, and omit thread_ts. Do not use a reply, thread, update, reaction, or delete action, and do not use any action requiring message_ts.
- Use Slack thread/reply actions only when the routine explicitly requests a reply to an existing message and a real parent message timestamp was supplied or retrieved.
- Never repeat the same tool call with identical arguments.
- Carry data returned by source tools into destination tools exactly as the routine requires.
- Do not invent retrieved content, destinations, recipients, identifiers, or successful actions.
- If a tool rejects the request before performing an external action because fields are missing or invalid, correct the tool choice or arguments once using the returned schema. Never retry an ambiguous failure that may have happened after the external action.
- When every required action succeeds, return status="completed", a concise summary, and error=null.
- If any required action fails, stop retrying the identical call and return status="failed", a concise failure summary, and the actual error.
`.trim(),
    });

    const routineResult = await run(agent, "Run the approved routine now.", {
        maxTurns: desktopTool ? 30 : 12,
    });

    if (!routineResult?.finalOutput) {
        throw new Error("The routine execution did not return a result");
    }

    return routineExecutionSchema.parse(routineResult.finalOutput);
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
    editingRoutine: RoutineDraft | null = null,
    vmDesktopAvailable = false
) =>
    `
You are ${agentName}.
${customInstructions}

User timezone: ${timezone}
Current date in the user's context: ${new Date().toISOString().slice(0, 10)}
Execution mode: ${planningOnly ? "ROUTINE_PLANNING_ONLY" : "GENERAL"}
VM desktop availability: ${vmDesktopAvailable ? "available" : "unavailable"}
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

You are an action-taking personal AI agent. You can converse, perform one-time actions with connected apps, use a persistent VM desktop, and design user-approved routines that run later on the user's behalf.
When VM desktop availability is "available", you have browser access through the VM desktop and Chrome. Do not say you cannot browse, cannot access websites, or cannot visit a platform. Use the VM desktop instead.

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
- If the routine requires website/browser work that is not represented in Available tools, draft it with routine.tools=[] for that browser-only part and write explicit VM desktop instructions in routine.instructions.
- For browser-only routines, tell the user the routine will run in the persistent VM desktop.
- Connection state never prevents drafting or clarifying a routine. The server and UI handle connection buttons and confirmation.

Immediate action rules:
- If every required app appears in Connected tools, execute the request with the provided Composio tools, then return type="message", intent="immediate_action".
- If a required app is in Available tools but not Connected tools, do not call tools. Return type="tool_connection", intent="immediate_action", and include it in suggestedTools.
- If the user asks you to open, browse, inspect, read, search, use, log into, navigate to, or operate any website/platform/app that is not covered by a connected app tool, use the VM desktop computer tool.
- If no Available tool can perform the requested website/browser task and VM desktop is available, use the VM desktop computer tool. Examples include reading public news from a website, searching a webpage, using a browser-only platform, inspecting web content visually, finding courses on a site, or navigating to a named platform.
- When using the VM desktop, open or reuse Chrome, navigate to the site, complete the requested task, and summarize exactly what you found. Include relevant page/source names and times/dates when visible.
- If a website or platform requires login, MFA, captcha, payment, or credentials and you cannot proceed, stop. Return type="message", intent="immediate_action", and ask the user to open the VM desktop and sign in there. Do not ask for passwords or secrets in chat.
- The VM desktop session persists across pause/inactivity and resumes where it was left.
- If an individual app action is not preloaded, call COMPOSIO_SEARCH_TOOLS once for that distinct operation, then call COMPOSIO_MULTI_EXECUTE_TOOL using the returned slug and schema.
- Before any action that sends, posts, publishes, creates, edits, deletes, or otherwise changes external data, make sure every required target and content detail is known.
- If a destination is missing, use a connected app's read-only tools to list real choices. For Slack, list accessible channels and return them as options on a clarification question. Do not guess a channel.
- After required details are known, retrieve and prepare any requested source content, then attempt the outbound action. The application will pause mutating tool calls and show the user a confirmation card before anything is changed.
- Never claim an outbound action succeeded until its tool call actually completed after approval.

Conversation rules:
- Return type="message", intent="conversation", questions=[], suggestedTools=[], routine=null.
- Answer directly and do not call external tools unless current external data, website access, platform access, or an app action is actually needed.
- If current external data or website/platform access is needed and VM desktop is available, use the VM desktop. Do not give manual browsing instructions as a substitute for doing the task.

Output rules:
- Write message as clear GitHub-flavored Markdown. Keep it concise and state what the user needs to do next.
- When VM desktop is available, finish with a plain Markdown answer for the user. Do not output JSON.
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
