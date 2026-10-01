import { NextResponse } from "next/server";
import { AuthError, requireUser } from "./session";
import { ensureSeeded } from "./auth";

export async function withUser<T>(fn: (user: { userId: string; email: string }) => Promise<T> | T) {
  try {
    await ensureSeeded();
    const user = await requireUser();
    const data = await fn(user);
    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "unexpected error";
  const status = error instanceof AuthError ? 401 : message.includes("invalid credentials") ? 401 : 400;
  return NextResponse.json({ error: message }, { status });
}
