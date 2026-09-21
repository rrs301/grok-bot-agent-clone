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

async function persistAgentSessionId(
    agentId: string,
    userEmail: string,
    composioSessionId: string
) {
    const [updatedAgent] = await db.update(AgentConfig).set({
        composioSessionId
    }).where(
        and(
            eq(AgentConfig.agentId, agentId),
            eq(AgentConfig.userEmail, userEmail)
        )
    ).returning({ composioSessionId: AgentConfig.composioSessionId });

    if (updatedAgent?.composioSessionId !== composioSessionId) {
        throw new Error("Unable to save the Composio session for this agent");
    }
}

async function createUnrestrictedAgentSession(
    agentId: string,
    userEmail: string
) {
    // An omitted toolkit filter lets this long-lived agent session discover new
    // apps later. Availability and authorization are still enforced by our
    // catalog, connection endpoints, and per-user connected accounts.
    const session = await composio.sessions.create(userEmail);
    await persistAgentSessionId(agentId, userEmail, session.sessionId);
    return session;
}

export async function getOrCreateAgentSession(
    agentConfig: AgentSessionConfig,
    userEmail: string,
    requiredToolSlugs: string[] = []
) {
    const configuredToolSlugs = getToolSlugs(agentConfig.tools);
    const toolSlugs = [
        ...new Map(
            [...configuredToolSlugs, ...requiredToolSlugs].map((slug) => [
                slug.toLowerCase(),
                slug,
            ])
        ).values(),
    ];

    // Prefer the agent's stable session, but recover from deleted/stale legacy
    // sessions. Older versions created sessions with an allow-list containing
    // only the apps connected at creation time.
    if (agentConfig.composioSessionId) {
        let existingSession;

        try {
            existingSession = await composio.sessions.use(agentConfig.composioSessionId);
        } catch (error) {
            console.warn("Replacing an unavailable Composio session", error);
            return createUnrestrictedAgentSession(agentConfig.agentId, userEmail);
        }

        if (requiredToolSlugs.length > 0) {
            try {
                // Switching from an `enable` allow-list to an empty `disable`
                // list removes the legacy restriction without replacing the
                // session or its runtime context.
                await existingSession.update({
                    toolkits: { disable: [] },
                    connectedAccounts: {},
                });

                const enabled = await existingSession.toolkits({
                    toolkits: requiredToolSlugs,
                    limit: Math.min(requiredToolSlugs.length, 50),
                });
                const enabledSlugs = new Set(
                    enabled.items.map((toolkit) => toolkit.slug.toLowerCase())
                );
                if (requiredToolSlugs.every((slug) => enabledSlugs.has(slug.toLowerCase()))) {
                    return existingSession;
                }
            } catch (error) {
                console.warn("Unable to expand the saved Composio session", error);
            }

            // Some legacy sessions cannot change filter mode. A fresh
            // unrestricted session reuses the user's persistent connections.
            return createUnrestrictedAgentSession(agentConfig.agentId, userEmail);
        }

        if (toolSlugs.length === 0) {
            return existingSession;
        }

        let hasStaleConnectionRestrictions = false;
        try {
            const [sessionToolkits, activeAccounts] = await Promise.all([
                existingSession.toolkits({
                    toolkits: toolSlugs,
                    limit: Math.min(toolSlugs.length, 50),
                }),
                getActiveConnectedAccounts(userEmail, toolSlugs),
            ]);
            const sessionConnections = new Set(
                sessionToolkits.items
                    .filter((toolkit) => toolkit.connection?.isActive)
                    .map((toolkit) => toolkit.slug.toLowerCase())
            );
            hasStaleConnectionRestrictions = toolSlugs.some((slug) =>
                Boolean(activeAccounts[slug.toLowerCase()]?.length) &&
                !sessionConnections.has(slug.toLowerCase())
            );
        } catch (error) {
            console.warn("Unable to verify the saved Composio session configuration", error);
        }

        if (hasStaleConnectionRestrictions) {
            try {
                await existingSession.update({
                    toolkits: { disable: [] },
                    connectedAccounts: {},
                });
            } catch (error) {
                console.warn("Replacing a restricted Composio session", error);
                return createUnrestrictedAgentSession(agentConfig.agentId, userEmail);
            }
        }

        return existingSession;
    }

    return createUnrestrictedAgentSession(agentConfig.agentId, userEmail);
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
