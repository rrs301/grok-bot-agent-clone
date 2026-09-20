import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { AgentConfig, db, Tools } from "@/db"
import { getActiveConnectedAccounts } from "@/lib/composio/service"
import { and, eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const agentId = req.nextUrl.searchParams.get("agentId")
  const toolkitSlug = req.nextUrl.searchParams.get("toolkitSlug")
  if (!agentId || !toolkitSlug) {
    return NextResponse.json({ error: "Missing agentId or toolkitSlug" }, { status: 400 })
  }

  const [[agent], [tool]] = await Promise.all([
    db
      .select({ agentId: AgentConfig.agentId })
      .from(AgentConfig)
      .where(
        and(
          eq(AgentConfig.agentId, agentId),
          eq(AgentConfig.userEmail, session.user.email)
        )
      )
      .limit(1),
    db
      .select({ slug: Tools.slug, isActive: Tools.isActive })
      .from(Tools)
      .where(eq(Tools.slug, toolkitSlug))
      .limit(1),
  ])

  if (!agent || !tool) {
    return NextResponse.json({ error: "Agent or tool not found" }, { status: 404 })
  }

  const accounts = await getActiveConnectedAccounts(session.user.email, [tool.slug])
  return NextResponse.json({
    isConnected: Boolean(accounts[tool.slug.toLowerCase()]?.length),
    isEnabled: tool.isActive !== false,
  })
}
