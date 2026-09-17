import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { db, users } from "@/db";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await db.insert(users).values({
            name: session?.user?.name,
            email: session?.user?.email,
        }).onConflictDoNothing({
            target: users.email
        })
            .returning();

        if (result.length === 0) {
            return NextResponse.json({ message: "User already exists" }, { status: 200 });
        }

        return NextResponse.json({ message: "User saved successfully", user: result });
    }
    catch (e) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}