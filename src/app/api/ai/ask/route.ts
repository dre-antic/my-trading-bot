import { askDesk } from "@/server/trading-service";
import { withUser } from "@/server/http";
import { detectPromptInjection } from "@/core/security";

export async function POST(req: Request) {
  const body = (await req.json()) as { question?: string };
  return withUser((user) => {
    const question = body.question ?? "";
    const inj = detectPromptInjection(question);
    if (inj.flagged) {
      return { answer: "The desk refused this prompt because it looks like an injection attempt.", usedLlm: false, flagged: true };
    }
    return askDesk(user.userId, question);
  });
}
