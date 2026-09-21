import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { triggerRoutineRunNow } from "@/lib/routines/run-now";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const runRoutineSchema = z.object({
  agentId: z.string().min(1),
  routineId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = runRoutineSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing agentId or routineId" },
      { status: 400 }
    );
  }

  const result = await triggerRoutineRunNow({
    ...parsed.data,
    userEmail: session.user.email,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      execution: result.execution,
      routine: result.routine,
      alreadyRunning: result.alreadyRunning,
    },
    { status: result.alreadyRunning ? 200 : 202 }
  );
}
