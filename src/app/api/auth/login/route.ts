import { NextResponse } from "next/server";
import { login } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { getSession } from "@/server/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) return NextResponse.json({ error: "email and password required" }, { status: 400 });
    const user = await login(body.email, body.password);
    const session = await getSession();
    session.userId = user.userId;
    session.email = user.email;
    await session.save();
    return NextResponse.json({ userId: user.userId, email: user.email, displayName: user.displayName });
  } catch (error) {
    return errorResponse(error);
  }
}
