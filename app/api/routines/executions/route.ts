import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db, RoutineExecutions, Routines } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

function summarizeExecution(result: unknown, error: string | null, status: string) {
  if (error) return error;

  if (result && typeof result === "object") {
    const summary = (result as { summary?: unknown }).summary;
    if (typeof summary === "string" && summary.trim()) return summary;
  }

  if (status === "completed") return "Routine completed successfully.";
  if (status === "running") return "Routine is currently running.";
  if (status === "queued") return "Routine is queued and waiting to run.";
  if (status === "skipped") return "Routine was skipped.";
  if (status === "failed") return "Routine failed before returning a summary.";

  return "No execution summary was recorded.";
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

  const rows = await db
    .select({
      id: RoutineExecutions.id,
      routineId: RoutineExecutions.routineId,
      routineName: Routines.name,
      status: RoutineExecutions.status,
      result: RoutineExecutions.result,
      error: RoutineExecutions.error,
      attempts: RoutineExecutions.attempts,
      scheduledFor: RoutineExecutions.scheduledFor,
      queuedAt: RoutineExecutions.queuedAt,
      startedAt: RoutineExecutions.startedAt,
      completedAt: RoutineExecutions.completedAt,
      updatedAt: RoutineExecutions.updatedAt,
    })
    .from(RoutineExecutions)
    .innerJoin(Routines, eq(RoutineExecutions.routineId, Routines.id))
    .where(
      and(
        eq(Routines.agentId, agentId),
        eq(Routines.userEmail, session.user.email)
      )
    )
    .orderBy(desc(RoutineExecutions.updatedAt))
    .limit(100);

  return NextResponse.json({
    executions: rows.map((row) => ({
      id: row.id,
      routineId: row.routineId,
      routineName: row.routineName,
      status: row.status,
      outputSummary: summarizeExecution(row.result, row.error, row.status),
      attempts: row.attempts,
      scheduledFor: row.scheduledFor,
      queuedAt: row.queuedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      updatedAt: row.updatedAt,
    })),
  });
}
