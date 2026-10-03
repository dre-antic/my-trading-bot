import { withUser } from "@/server/http";
import { submitTicket, type TicketRequest } from "@/server/ticket";

export async function POST(req: Request) {
  const body = (await req.json()) as TicketRequest & { execution?: "paper" | "live" };
  const execution = body.execution === "live" ? "live" : "paper";
  return withUser((user) => submitTicket(user.userId, body, execution));
}
