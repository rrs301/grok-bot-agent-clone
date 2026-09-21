import { AgentConfig, db } from "@/db"
import { and, eq, sql } from "drizzle-orm"

/**
 * Persist whether a tool is available to a specific agent.
 *
 * The JSONB expressions keep the update atomic and idempotent because tool
 * status can be polled more than once while an OAuth window is open.
 */
export async function setAgentToolConnection(
  agentId: string,
  userEmail: string,
  toolSlug: string,
  isConnected: boolean
) {
  const currentTools = sql`
    CASE
      WHEN jsonb_typeof(COALESCE(${AgentConfig.tools}, '[]'::jsonb)) = 'array'
        THEN COALESCE(${AgentConfig.tools}, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  `
  const slugAsArray = JSON.stringify([toolSlug])
  const nextTools = isConnected
    ? sql`
        CASE
          WHEN ${currentTools} @> ${slugAsArray}::jsonb THEN ${currentTools}
          ELSE ${currentTools} || ${slugAsArray}::jsonb
        END
      `
    : sql`${currentTools} - ${toolSlug}`

  const [updatedAgent] = await db
    .update(AgentConfig)
    .set({ tools: nextTools })
    .where(
      and(
        eq(AgentConfig.agentId, agentId),
        eq(AgentConfig.userEmail, userEmail)
      )
    )
    .returning({ tools: AgentConfig.tools })

  if (!updatedAgent) {
    throw new Error("Unable to update tools for this agent")
  }

  return updatedAgent.tools
}
