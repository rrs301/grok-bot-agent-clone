import { AgentConfigType } from "@/type/Agent";
import { composio } from "./composio";
import { AgentConfig, db } from "@/db";
import { eq } from "drizzle-orm";


export async function getOrCreateAgentSession(agentConfig: AgentConfigType, userEmail: string) {
    if (agentConfig?.composioSessionId) {
        try {
            const session = await composio.sessions.use(agentConfig?.composioSessionId)
            if (session) return session
        } catch (e) {
            console.warn('Recreate new session')
        }
    }

    const toolSlug = agentConfig?.tools || [];

    const connectedAccounts = await getActiveConnectedAccounts(userEmail, toolSlug);

    const session = await composio.sessions.create(userEmail, {
        toolkits: toolSlug.length > 0 ? toolSlug : undefined,
        connectedAccounts: Object.keys(connectedAccounts).length > 0 ? connectedAccounts : undefined
    })

    //save sessionId to DB
    const result = await db.update(AgentConfig).set({
        composioSessionId: (session as any).sessionId || session.sessionId
    }).where(eq(AgentConfig.agentId, agentConfig.agentId));


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




