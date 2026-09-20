import { Agent, assistant, run, user } from "@openai/agents";
import { agentResponseSchema } from "./agent-response-schema";

export type Message = {
    role: "user" | "agent" | "assistant";
    content: string;
};

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
    timezone = "UTC"
) => {
    const formattedInstructions = buildAgentInstructions(
        name,
        instructions,
        availableTools,
        timezone
    );
    const agent = createAgent(name, formattedInstructions, tools);

    const history = messages.map((msg) =>
        msg.role === "assistant" || msg.role === "agent"
            ? assistant(msg.content)
            : user(msg.content)
    );

    const result = await run(agent, history);

    return agentResponseSchema.parse(result.finalOutput);
};


export const buildAgentInstructions = (
    agentName: string,
    customInstructions: string,
    availableTools: Array<{
        slug: string;
        name: string;
        description: string;
    }>,
    timezone: string
) =>
    `
You are ${agentName}.
${customInstructions}

User timezone: ${timezone}

Available tools catalog:
${availableTools
            .map((tool) => `- ${tool.slug}: ${tool.name} - ${tool.description}`)
            .join("\n")}

Behavior Rules:
1. Return type="message" for normal conversation or when you have already executed connected tools to answer the user's request.
2. Return type="tool_connection" if the user asks for an immediate action requiring an external app (e.g. Gmail, GitHub, Slack) but you do NOT currently have active tool execution access. Explain why the tool is needed in "message" and include the tool slug and reason in "suggestedTools".
3. Return type="clarification" if routine information is missing.
4. Return type="routine" for scheduled or repeated work.

Never claim a tool is connected if you cannot execute it directly.
Suggest only tool slugs from the Available tools catalog.
`.trim();
