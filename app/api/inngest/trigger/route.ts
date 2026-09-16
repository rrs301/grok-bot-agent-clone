import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

/**
 * Example API Endpoint to trigger/enqueue an Inngest background event
 * POST /api/inngest/trigger
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const taskId = body.taskId || `task_${Date.now()}`;

    // Send an event to Inngest to trigger the background function
    const result = await inngest.send({
      name: 'app/task.process',
      data: {
        taskId,
        message: body.message || 'Background task triggered from API route',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Background job enqueued successfully!',
      result,
      taskId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
