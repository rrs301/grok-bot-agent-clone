import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { AgentConfig, db, RoutineExecutions, Routines, Tools } from "@/db";
import { getActiveConnectedAccounts } from "@/lib/composio/service";
import { routineSchema } from "@/lib/openai/agent-response-schema";
import { getNextRunAt, normalizeRoutineSchedule } from "@/lib/routines/schedule";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createRoutineSchema = z.object({
  agentId: z.string().min(1),
  routine: routineSchema,
});

const updateRoutineSchema = z.object({
  agentId: z.string().min(1),
  routineId: z.string().min(1),
  routine: routineSchema.optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => data.routine !== undefined || typeof data.isActive === "boolean",
  {
    message: "Provide either a routine payload or an active status update",
    path: ["routine"],
  }
);

async function getOwnedAgent(agentId: string, userEmail: string) {
  const [agent] = await db
    .select({ agentId: AgentConfig.agentId })
    .from(AgentConfig)
    .where(
      and(
        eq(AgentConfig.agentId, agentId),
        eq(AgentConfig.userEmail, userEmail)
      )
    )
    .limit(1);

  return agent;
}

async function prepareRoutine(
  routine: z.infer<typeof routineSchema>,
  userEmail: string
) {
  const normalizedRoutine = {
    ...routine,
    schedule: normalizeRoutineSchedule(routine.schedule),
  };

  const requestedSlugs = [
    ...new Set(normalizedRoutine.tools.map((tool) => tool.slug.toLowerCase())),
  ];
  const availableTools = requestedSlugs.length > 0
    ? await db
      .select({ slug: Tools.slug })
      .from(Tools)
      .where(
        and(
          inArray(Tools.slug, normalizedRoutine.tools.map((tool) => tool.slug)),
          eq(Tools.isActive, true)
        )
      )
    : [];
  const availableBySlug = new Map(
    availableTools.map((tool) => [tool.slug.toLowerCase(), tool.slug])
  );
  const unavailableTools = requestedSlugs.filter(
    (slug) => !availableBySlug.has(slug)
  );

  if (unavailableTools.length > 0) {
    return { error: "One or more required tools are unavailable", missingTools: unavailableTools } as const;
  }

  const canonicalSlugs = requestedSlugs.map((slug) => availableBySlug.get(slug)!);
  const connectedAccounts = await getActiveConnectedAccounts(userEmail, canonicalSlugs);
  const disconnectedTools = canonicalSlugs.filter(
    (slug) => !connectedAccounts[slug.toLowerCase()]?.length
  );

  if (disconnectedTools.length > 0) {
    return {
      error: "Connect every required tool before saving this routine",
      missingTools: disconnectedTools,
    } as const;
  }

  let nextRunAt: Date | null;
  try {
    nextRunAt = getNextRunAt(normalizedRoutine.schedule);
  } catch {
    return { error: "The routine schedule or timezone is invalid" } as const;
  }

  if (!nextRunAt) {
    return { error: "The routine does not have a future run time" } as const;
  }

  return {
    nextRunAt,
    normalizedTools: normalizedRoutine.tools.map((tool) => ({
      ...tool,
      slug: availableBySlug.get(tool.slug.toLowerCase())!,
    })),
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createRoutineSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The routine proposal is incomplete or invalid" },
      { status: 400 }
    );
  }

  const { agentId, routine } = parsed.data;
  const normalizedRoutine = {
    ...routine,
    schedule: normalizeRoutineSchedule(routine.schedule),
  };
  const agent = await getOwnedAgent(agentId, session.user.email);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const prepared = await prepareRoutine(normalizedRoutine, session.user.email);
  if ("error" in prepared) {
    return NextResponse.json(prepared, {
      status: "missingTools" in prepared ? 409 : 400,
    });
  }

  const routineId = crypto.randomUUID();
  const [created] = await db
    .insert(Routines)
    .values({
      id: routineId,
      agentId,
      userEmail: session.user.email,
      name: normalizedRoutine.name,
      goal: normalizedRoutine.goal,
      instructions: normalizedRoutine.instructions,
      schedule: normalizedRoutine.schedule,
      tools: prepared.normalizedTools,
      nextRunAt: prepared.nextRunAt,
    })
    .returning();
  return NextResponse.json({ routine: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateRoutineSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The routine update is incomplete or invalid" },
      { status: 400 }
    );
  }

  const { agentId, routineId, routine, isActive } = parsed.data;

  if (typeof isActive === "boolean") {
    const [updated] = await db
      .update(Routines)
      .set({ isActive })
      .where(
        and(
          eq(Routines.id, routineId),
          eq(Routines.agentId, agentId),
          eq(Routines.userEmail, session.user.email)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }

    return NextResponse.json({ routine: updated });
  }

  if (!routine) {
    return NextResponse.json(
      { error: "The routine update is incomplete or invalid" },
      { status: 400 }
    );
  }

  const normalizedRoutine = {
    ...routine,
    schedule: normalizeRoutineSchedule(routine.schedule),
  };
  if (!(await getOwnedAgent(agentId, session.user.email))) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const [existing] = await db
    .select({ id: Routines.id, nextRunAt: Routines.nextRunAt })
    .from(Routines)
    .where(
      and(
        eq(Routines.id, routineId),
        eq(Routines.agentId, agentId),
        eq(Routines.userEmail, session.user.email)
      )
    )
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  }

  const prepared = await prepareRoutine(normalizedRoutine, session.user.email);
  if ("error" in prepared) {
    return NextResponse.json(prepared, {
      status: "missingTools" in prepared ? 409 : 400,
    });
  }

  const scheduleChanged = existing.nextRunAt?.getTime() !== prepared.nextRunAt.getTime();
  // Do not enqueue or integrate with Inngest here. Persist the updated
  // schedule and let the application handle scheduling separately.

  const [updated] = await db
    .update(Routines)
    .set({
      name: normalizedRoutine.name,
      goal: normalizedRoutine.goal,
      instructions: normalizedRoutine.instructions,
      schedule: normalizedRoutine.schedule,
      tools: prepared.normalizedTools,
      nextRunAt: prepared.nextRunAt,
      isActive: true,
    })
    .where(
      and(
        eq(Routines.id, routineId),
        eq(Routines.agentId, agentId),
        eq(Routines.userEmail, session.user.email)
      )
    )
    .returning();

  return NextResponse.json({ routine: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get("agentId");
  const routineId = req.nextUrl.searchParams.get("routineId");
  if (!agentId || !routineId) {
    return NextResponse.json(
      { error: "Missing agentId or routineId" },
      { status: 400 }
    );
  }

  const [deleted] = await db
    .delete(Routines)
    .where(
      and(
        eq(Routines.id, routineId),
        eq(Routines.agentId, agentId),
        eq(Routines.userEmail, session.user.email)
      )
    )
    .returning({ id: Routines.id });

  if (!deleted) {
    return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  const routines = await db
    .select()
    .from(Routines)
    .where(
      and(
        eq(Routines.agentId, agentId),
        eq(Routines.userEmail, session.user.email)
      )
    )
    .orderBy(desc(Routines.createdAt));

  const latestExecutions = routines.length > 0
    ? await db
      .select()
      .from(RoutineExecutions)
      .where(inArray(RoutineExecutions.routineId, routines.map((routine) => routine.id)))
      .orderBy(desc(RoutineExecutions.queuedAt))
    : [];
  const latestExecutionByRoutineId = new Map<string, typeof latestExecutions[number]>();
  for (const execution of latestExecutions) {
    if (!latestExecutionByRoutineId.has(execution.routineId)) {
      latestExecutionByRoutineId.set(execution.routineId, execution);
    }
  }

  return NextResponse.json({
    routines: routines.map((routine) => {
      const latestExecution = latestExecutionByRoutineId.get(routine.id);
      const executionIsPendingNow = latestExecution?.status === "queued"
        && latestExecution.scheduledFor.getTime() <= Date.now();
      const executionStatus = latestExecution?.status === "queued" && !executionIsPendingNow
        ? undefined
        : latestExecution?.status;
      return {
        ...routine,
        executionStatus,
        latestExecutionId: latestExecution?.id ?? null,
        latestExecutionError: latestExecution?.error ?? null,
        latestExecutionCompletedAt: latestExecution?.completedAt ?? null,
      };
    }),
  });
}
