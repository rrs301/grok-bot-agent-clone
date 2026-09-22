import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { AgentConfig, db } from "@/db"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { desc, eq } from "drizzle-orm"

async function WorkspacePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect("/sign-in?callbackUrl=/workspace")
  }

  const [topAgent] = await db
    .select({ agentId: AgentConfig.agentId })
    .from(AgentConfig)
    .where(eq(AgentConfig.userEmail, session.user.email))
    .orderBy(desc(AgentConfig.createdAt))
    .limit(1)

  if (topAgent?.agentId) {
    redirect(`/workspace/${encodeURIComponent(topAgent.agentId)}`)
  }

  redirect("/workspace/create")
}

export default WorkspacePage
