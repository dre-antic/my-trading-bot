import { describe, expect, it } from "vitest";
import { Money, MoneyError, Qty, notional, roundToLot, roundToTick } from "@/core/money";

describe("money", () => {
  it("adds and subtracts same-currency amounts", () => {
    const a = new Money("10.10");
    const b = new Money("0.20");
    expect(a.add(b).toFixed(2)).toBe("10.30");
    expect(a.sub(b).toFixed(2)).toBe("9.90");
  });

  it("rejects currency mismatch and non-finite numbers", () => {
    expect(() => new Money("1", "USD").add(new Money("1", "EUR"))).toThrow(MoneyError);
    expect(() => new Money(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });

  it("rounds to tick and lot without floating residue", () => {
    expect(roundToTick("1.234", "0.01").toString()).toBe("1.23");
    expect(roundToLot("1.239", "0.01").toString()).toBe("1.23");
  });

  it("computes notional from price and quantity strings", () => {
    expect(notional("100.25", "3").toFixed(2)).toBe("300.75");
  });

  it("keeps quantity arithmetic exact", () => {
    expect(new Qty("0.1").add("0.2").toString()).toBe("0.3");
  });
});
