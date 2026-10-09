import { canPromoteToLive, evaluatePromotionGates, evaluateRobustnessGates, type ValidationEvidence } from "@/core/laboratory";
import { ids } from "@/core/ids";
import { toIsoUtc } from "@/core/time";
import { getDb } from "@/db/client";
import { audit } from "./audit";
import { getStrategy, listStrategies, runStrategyBacktest } from "./trading-service";
import { dispatchNotification } from "./notifications";

export function listExperiments(userId: string) {
  return getDb()
    .prepare("SELECT * FROM strategy_experiments WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId);
}

export function createExperiment(userId: string, championStrategyId: string, challengerStrategyId: string) {
  if (championStrategyId === challengerStrategyId) throw new Error("Champion and challenger must be different strategies.");
  getStrategy(userId, championStrategyId);
  getStrategy(userId, challengerStrategyId);
  const id = ids.experiment();
  getDb()
    .prepare(
      "INSERT INTO strategy_experiments (id, user_id, champion_strategy_id, challenger_strategy_id, status, notes, created_at) VALUES (?, ?, ?, ?, 'RESEARCH', ?, ?)",
    )
    .run(id, userId, championStrategyId, challengerStrategyId, "Created. Automatic promotion is disabled.", toIsoUtc());
  audit({ userId, action: "lab.experiment_created", entity: "experiment", entityId: id });
  return { id };
}

export function evaluateExperiment(userId: string, experimentId: string, userApproved: boolean) {
  const exp = getDb()
    .prepare("SELECT * FROM strategy_experiments WHERE id = ? AND user_id = ?")
    .get(experimentId, userId) as
    | { id: string; champion_strategy_id: string; challenger_strategy_id: string; status: string }
    | undefined;
  if (!exp) throw new Error("experiment not found");
  const challenger = getStrategy(userId, exp.challenger_strategy_id);
  const suite = runStrategyBacktest(userId, exp.challenger_strategy_id);
  const evidence: ValidationEvidence = {
    challengerLifecycle: lifecycleFromSuite(challenger.lifecycle, suite.oos.outOfSample.metrics.trades, suite.wf.windows.length),
    outOfSampleTrades: suite.oos.outOfSample.metrics.trades,
    walkForwardWindows: suite.wf.windows.length,
    maxDrawdownPct: Number(suite.full.metrics.maxDrawdown),
    userApproved,
  };
  const robustness = evaluateRobustnessGates(evidence);
  const gate = evaluatePromotionGates(evidence);
  getDb()
    .prepare("UPDATE strategy_experiments SET status = ?, notes = ? WHERE id = ?")
    .run(gate.passed ? "GATED" : robustness.passed ? "GATED" : "RESEARCH", JSON.stringify({ gate, robustness, evidence }), experimentId);
  return {
    experimentId,
    gate,
    robustness,
    evidence,
    livePromotionAllowed: canPromoteToLive(),
    suite: { trades: suite.full.metrics.trades, oos: suite.oos.outOfSample.metrics.totalReturn },
  };
}

export function promoteExperiment(userId: string, experimentId: string, confirmPhrase: string) {
  if (confirmPhrase !== "PROMOTE CHALLENGER") {
    throw new Error('Confirmation phrase must be exactly "PROMOTE CHALLENGER".');
  }
  const evaluated = evaluateExperiment(userId, experimentId, true);
  if (!evaluated.gate.passed) {
    throw new Error(`Promotion blocked: ${evaluated.gate.failures.join(" ")}`);
  }
  const exp = getDb()
    .prepare("SELECT * FROM strategy_experiments WHERE id = ? AND user_id = ?")
    .get(experimentId, userId) as { champion_strategy_id: string; challenger_strategy_id: string };
  if (canPromoteToLive()) {
    throw new Error("LIVE promotion is disabled. This path cannot enable live trading.");
  }
  getDb().prepare("UPDATE strategies SET lifecycle = 'RETIRED' WHERE id = ? AND user_id = ?").run(exp.champion_strategy_id, userId);
  getDb().prepare("UPDATE strategies SET lifecycle = 'APPROVED' WHERE id = ? AND user_id = ?").run(exp.challenger_strategy_id, userId);
  getDb().prepare("UPDATE strategy_experiments SET status = 'PROMOTED' WHERE id = ?").run(experimentId);
  audit({ userId, action: "lab.promoted", entity: "experiment", entityId: experimentId, payload: { champion: exp.champion_strategy_id, challenger: exp.challenger_strategy_id } });
  void dispatchNotification({
    userId,
    kind: "strategy",
    title: "Challenger promoted",
    body: `${exp.challenger_strategy_id} replaced ${exp.champion_strategy_id} as APPROVED (not LIVE).`,
  });
  return { ok: true, newChampion: exp.challenger_strategy_id, retired: exp.champion_strategy_id };
}

export function laboratoryOverview(userId: string) {
  return { experiments: listExperiments(userId), strategies: listStrategies(userId) };
}

function lifecycleFromSuite(
  stored: ValidationEvidence["challengerLifecycle"],
  oosTrades: number,
  walkForwardWindows: number,
): ValidationEvidence["challengerLifecycle"] {
  if (stored === "APPROVED" || stored === "PAPER" || stored === "LIVE" || stored === "WALK_FORWARD") return stored;
  if (walkForwardWindows >= 2) return "WALK_FORWARD";
  if (oosTrades > 0) return "OUT_OF_SAMPLE";
  return stored;
}
