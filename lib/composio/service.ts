import { composio } from "./composio";
import { AgentConfig, db } from "@/db";
import { and, eq } from "drizzle-orm";

type AgentSessionConfig = {
    agentId: string;
    composioSessionId?: string | null;
    tools?: unknown;
};

function getToolSlugs(tools: unknown) {
    if (!Array.isArray(tools)) return [];

    return tools.filter((tool): tool is string => typeof tool === "string" && tool.length > 0);
}

export async function getOrCreateAgentSession(
    agentConfig: AgentSessionConfig,
    userEmail: string,
    requiredToolSlugs: string[] = []
) {
    const toolSlugs = [
        ...new Set([...getToolSlugs(agentConfig.tools), ...requiredToolSlugs]),
    ];

    if (agentConfig.composioSessionId) {
        return composio.sessions.use(agentConfig.composioSessionId);
    }

    const connectedAccounts = await getActiveConnectedAccounts(userEmail, toolSlugs);

    const session = await composio.sessions.create(userEmail, {
        toolkits: toolSlugs.length > 0 ? toolSlugs : undefined,
        connectedAccounts: Object.keys(connectedAccounts).length > 0 ? connectedAccounts : undefined
    });

    const [updatedAgent] = await db.update(AgentConfig).set({
        composioSessionId: session.sessionId
    }).where(
        and(
            eq(AgentConfig.agentId, agentConfig.agentId),
            eq(AgentConfig.userEmail, userEmail)
        )
    ).returning({ composioSessionId: AgentConfig.composioSessionId });

    if (updatedAgent?.composioSessionId !== session.sessionId) {
        throw new Error("Unable to save the Composio session for this agent");
    }

    return session;
}



export const getActiveConnectedAccounts = async (userEmail: string, toolSlugs: string[]) => {
    if (!toolSlugs || toolSlugs.length === 0) return {};
    try {
        const accounts = await composio.connectedAccounts.list({
            userIds: [userEmail],
            toolkitSlugs: toolSlugs,
            statuses: ["ACTIVE"],
        });

        return accounts.items.reduce((acc: Record<string, string[]>, account: any) => {
            const slug = account?.toolkit?.slug?.toLowerCase();
            if (slug) {
                if (!acc[slug]) acc[slug] = [];
                acc[slug].push(account.id);
            }
            return acc;
        }, {});
    } catch (err) {
        console.error("Error fetching accounts:", err);
        return {};
    }
};

