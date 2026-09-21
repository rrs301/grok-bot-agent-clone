import { db, RoutineExecutions, Routines } from "@/db";
import { inngest } from "@/lib/inngest/client";
import { and, desc, eq, inArray } from "drizzle-orm";

export type RoutineRunNowResult = {
  execution: typeof RoutineExecutions.$inferSelect;
  routine: typeof Routines.$inferSelect;
  alreadyRunning: boolean;
};

export async function triggerRoutineRunNow({
  agentId,
  routineId,
  userEmail,
}: {
  agentId: string;
  routineId: string;
  userEmail: string;
}): Promise<RoutineRunNowResult | { error: string; status: number }> {
  const [routine] = await db
    .select()
    .from(Routines)
    .where(
      and(
        eq(Routines.id, routineId),
        eq(Routines.agentId, agentId),
        eq(Routines.userEmail, userEmail)
      )
    )
    .limit(1);

  if (!routine) {
    return { error: "Routine not found", status: 404 };
  }

  if (!routine.isActive) {
    return { error: "Activate this routine before running it.", status: 409 };
  }

  const activeExecutions = await db
    .select()
    .from(RoutineExecutions)
    .where(
      and(
        eq(RoutineExecutions.routineId, routineId),
        inArray(RoutineExecutions.status, ["queued", "running"])
      )
    )
    .orderBy(desc(RoutineExecutions.queuedAt))
    .limit(10);
  const activeExecution = activeExecutions.find((execution) =>
    execution.status === "running" || execution.scheduledFor.getTime() <= Date.now()
  );

  if (activeExecution) {
    return { execution: activeExecution, routine, alreadyRunning: true };
  }

  const now = new Date();
  const executionId = `${routineId}:manual:${now.getTime()}`;
  const [execution] = await db
    .insert(RoutineExecutions)
    .values({
      id: executionId,
      routineId,
      scheduledFor: now,
      status: "queued",
    })
    .returning();

  await inngest.send({
    id: `routine-run-${executionId}`,
    name: "routine/run",
    data: {
      executionId,
      routineId,
      scheduledFor: now.toISOString(),
      trigger: "manual",
    },
  });

  return { execution, routine, alreadyRunning: false };
}
