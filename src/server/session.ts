import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { loadConfig } from "./config";

export interface SessionData {
  userId?: string;
  email?: string;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const config = loadConfig();
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    password: config.sessionSecret.padEnd(32, "x"),
    cookieName: "atcc_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  });
}

export async function requireUser(): Promise<{ userId: string; email: string }> {
  const session = await getSession();
  if (!session.userId || !session.email) {
    throw new AuthError("authentication required");
  }
  return { userId: session.userId, email: session.email };
}

export class AuthError extends Error {
  status = 401;
}
