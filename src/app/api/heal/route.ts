import { isForbiddenHeal } from "@/core/self-heal";
import { withUser } from "@/server/http";
import { diagnoseSelfHeal, refuseForbiddenHeal, runSelfHeal } from "@/server/self-heal";

export async function GET() {
  return withUser((user) => {
    const findings = diagnoseSelfHeal(user.userId);
    return {
      findings,
      auto: findings.filter((f) => f.auto),
      needsHuman: findings.filter((f) => f.severity === "needs_human"),
      refused: ["enable_live", "arm_live", "place_order", "reset_circuit_breaker"],
    };
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  return withUser(async (user) => {
    if (body.action && isForbiddenHeal(body.action)) {
      refuseForbiddenHeal(body.action);
    }
    return runSelfHeal({ userId: user.userId, force: true });
  });
}
