import { db, nowIso } from "../db/index.js";
import { config } from "../config/index.js";
import type { CostRecord } from "../types/index.js";

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public estimatedUsd: number,
    public needsApproval: boolean,
  ) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export class BudgetManager {
  spentToday(): number {
    const day = nowIso().slice(0, 10);
    const row = db.prepare("SELECT COALESCE(SUM(actual_usd),0) as t FROM costs WHERE day = ? AND paid = 1").get(day) as {
      t: number;
    };
    return row.t;
  }

  spentThisMonth(): number {
    const month = nowIso().slice(0, 7);
    const row = db.prepare("SELECT COALESCE(SUM(actual_usd),0) as t FROM costs WHERE month = ? AND paid = 1").get(
      month,
    ) as { t: number };
    return row.t;
  }

  jobSpend(jobId: string): number {
    const row = db.prepare("SELECT COALESCE(SUM(actual_usd),0) as t FROM costs WHERE job_id = ?").get(jobId) as {
      t: number;
    };
    return row.t;
  }

  authorize(opts: {
    jobId: string;
    estimatedUsd: number;
    paid: boolean;
    jobBudgetUsd: number;
    autoApprovePaid?: boolean;
  }): { allowed: boolean; reason?: string; needsApproval?: boolean } {
    if (!opts.paid || opts.estimatedUsd <= 0) {
      return { allowed: true };
    }
    if (!config.allowPaidProviders) {
      return { allowed: false, reason: "Paid providers are disabled (ALLOW_PAID_PROVIDERS=false)." };
    }
    if (this.spentToday() + opts.estimatedUsd > config.maxDailySpend) {
      return { allowed: false, reason: `Would exceed MAX_DAILY_SPEND ($${config.maxDailySpend}).` };
    }
    if (this.spentThisMonth() + opts.estimatedUsd > config.maxMonthlySpend) {
      return { allowed: false, reason: `Would exceed MAX_MONTHLY_SPEND ($${config.maxMonthlySpend}).` };
    }
    if (this.jobSpend(opts.jobId) + opts.estimatedUsd > opts.jobBudgetUsd) {
      return {
        allowed: false,
        needsApproval: true,
        reason: `Estimated $${opts.estimatedUsd.toFixed(4)} exceeds remaining job budget.`,
      };
    }
    if (opts.estimatedUsd > config.requireApprovalAboveCost && !opts.autoApprovePaid) {
      return {
        allowed: false,
        needsApproval: true,
        reason: `Estimated $${opts.estimatedUsd.toFixed(4)} requires explicit approval.`,
      };
    }
    return { allowed: true };
  }

  record(jobId: string, rec: CostRecord): void {
    const ts = nowIso();
    db.prepare(
      `INSERT INTO costs (job_id, day, month, provider, operation, estimated_usd, actual_usd, paid, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      jobId,
      ts.slice(0, 10),
      ts.slice(0, 7),
      rec.provider,
      rec.operation,
      rec.estimatedUsd,
      rec.actualUsd,
      rec.paid ? 1 : 0,
      ts,
    );
  }
}

export const budget = new BudgetManager();
