import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { AgentConfig, db, Tools } from "@/db"
import { setAgentToolConnection } from "@/lib/agent-tools"
import { composio } from "@/lib/composio/composio"
import { and, eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const requestSchema = z.object({
  agentId: z.string().min(1),
  toolkitSlug: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = requestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid disconnect request" }, { status: 400 })
  }

  const { agentId, toolkitSlug } = parsed.data
  const [[agent], [tool]] = await Promise.all([
    db
      .select({
        agentId: AgentConfig.agentId,
        composioSessionId: AgentConfig.composioSessionId,
      })
      .from(AgentConfig)
      .where(
        and(
          eq(AgentConfig.agentId, agentId),
          eq(AgentConfig.userEmail, session.user.email)
        )
      )
      .limit(1),
    db
      .select({ slug: Tools.slug })
      .from(Tools)
      .where(eq(Tools.slug, toolkitSlug))
      .limit(1),
  ])

  if (!agent || !tool) {
    return NextResponse.json({ error: "Agent or tool not found" }, { status: 404 })
  }

  try {
    const accounts = await composio.connectedAccounts.list({
      userIds: [session.user.email],
      toolkitSlugs: [tool.slug],
      statuses: ["ACTIVE"],
    })

    await Promise.all(
      accounts.items.map((account) => composio.connectedAccounts.delete(account.id))
    )

    const remainingTools = await setAgentToolConnection(
      agentId,
      session.user.email,
      tool.slug,
      false
    )

    if (agent.composioSessionId && Array.isArray(remainingTools) && remainingTools.length > 0) {
      const composioSession = await composio.sessions.use(agent.composioSessionId)
      await composioSession.update({
        toolkits: remainingTools.filter((slug): slug is string => typeof slug === "string"),
        connectedAccounts: {},
      })
    }

    return NextResponse.json({ isConnected: false })
  } catch (error) {
    console.error("Unable to disconnect tool", error)
    return NextResponse.json({ error: "Unable to disconnect tool" }, { status: 502 })
  }
}
