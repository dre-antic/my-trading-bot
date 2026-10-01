import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTITUTION_LIMITS, parseConstitution } from "@/core/constitution";
import { evaluateRiskFirewall } from "@/core/risk-firewall";
import { sizePosition } from "@/core/position-sizing";
import { Money } from "@/core/money";
import { emptyPortfolio } from "@/core/portfolio";
import { DEFAULT_EQUITY_PRECISION } from "@/core/money";
import type { InstrumentSpec } from "@/core/types";

const instrument: InstrumentSpec = {
  id: "spy",
  symbol: "SPY",
  assetClass: "etf",
  currency: "USD",
  venue: "ARCA",
  ...DEFAULT_EQUITY_PRECISION,
  timezone: "America/New_York",
  tradingHours: "rth",
};

function constitution() {
  return parseConstitution({
    id: "con_1",
    version: 1,
    createdAt: new Date().toISOString(),
    authorizedByUserId: "usr_1",
    ...DEFAULT_CONSTITUTION_LIMITS,
  });
}

function request(overrides: Record<string, unknown> = {}) {
  const sizing = sizePosition({
    method: "percent_account_risk",
    accountEquity: new Money("100000"),
    cash: new Money("100000"),
    buyingPower: new Money("100000"),
    entry: "100",
    stop: "99",
    direction: "long",
    instrument,
    riskPct: "0.25",
    estimatedFeeBps: "1",
    estimatedSlippageBps: "1",
  });
  return {
    constitution: constitution(),
    now: new Date(),
    userId: "usr_1",
    accountId: "acct_1",
    broker: "paper",
    environment: "paper" as const,
    liveEnabled: false,
    autonomousEnabled: false,
    tradingMode: "assisted" as const,
    displayMode: "demo" as const,
    strategyId: "edu_trend_following",
    strategyVersion: 1,
    instrument,
    market: "ARCA",
    direction: "long" as const,
    sizing,
    portfolio: emptyPortfolio("acct_1", "100000"),
    dataTimestamp: new Date().toISOString(),
    signalTimestamp: new Date().toISOString(),
    withinTradingHours: true,
    newsRestricted: false,
    stopPresent: true,
    ...overrides,
  };
}

describe("risk firewall", () => {
  it("approves a conservative paper proposal", () => {
    const result = evaluateRiskFirewall(request());
    expect(result.decision).toBe("APPROVED");
    expect(result.violations).toEqual([]);
  });

  it("rejects live trading when live is disabled", () => {
    const result = evaluateRiskFirewall(request({ environment: "live", displayMode: "live" }));
    expect(result.decision).toBe("REJECTED");
    expect(result.violations.some((v) => v.code === "LIVE_DISABLED")).toBe(true);
  });

  it("rejects research-mode execution and emergency halt", () => {
    const halted = evaluateRiskFirewall(request({ tradingMode: "research", constitution: { ...constitution(), emergencyHalt: true } }));
    expect(halted.decision).toBe("REJECTED");
    expect(halted.violations.map((v) => v.code)).toEqual(expect.arrayContaining(["RESEARCH_MODE", "EMERGENCY_HALT"]));
  });

  it("rejects stale data and missing stops", () => {
    const result = evaluateRiskFirewall(
      request({
        dataTimestamp: "2000-01-01T00:00:00.000Z",
        stopPresent: false,
      }),
    );
    expect(result.violations.map((v) => v.code)).toEqual(expect.arrayContaining(["STALE_DATA", "STOP_REQUIRED"]));
  });

  it("rejects oversized risk", () => {
    const sizing = sizePosition({
      method: "fixed_dollar_risk",
      accountEquity: new Money("100000"),
      cash: new Money("100000"),
      buyingPower: new Money("100000"),
      entry: "100",
      stop: "90",
      direction: "long",
      instrument,
      fixedRisk: new Money("5000"),
    });
    const result = evaluateRiskFirewall(request({ sizing }));
    expect(result.decision).toBe("REJECTED");
    expect(result.violations.some((v) => v.code === "TRADE_RISK_LIMIT")).toBe(true);
  });
});
