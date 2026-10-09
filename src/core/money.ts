import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

export type DecimalLike = string | number | Decimal | Qty | Money;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function toDecimal(value: DecimalLike): Decimal {
  try {
    if (value instanceof Qty) return value.value;
    if (value instanceof Money) return value.amount.value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new MoneyError("non-finite number cannot represent money");
      }
    }
    return new Decimal(value);
  } catch (error) {
    if (error instanceof MoneyError) throw error;
    throw new MoneyError(`invalid decimal value: ${String(value)}`);
  }
}

export class Qty {
  readonly value: Decimal;

  constructor(value: DecimalLike) {
    this.value = toDecimal(value);
  }

  add(other: DecimalLike): Qty {
    return new Qty(this.value.add(toDecimal(other)));
  }

  sub(other: DecimalLike): Qty {
    return new Qty(this.value.sub(toDecimal(other)));
  }

  mul(other: DecimalLike): Qty {
    return new Qty(this.value.mul(toDecimal(other)));
  }

  div(other: DecimalLike): Qty {
    const d = toDecimal(other);
    if (d.isZero()) throw new MoneyError("division by zero");
    return new Qty(this.value.div(d));
  }

  abs(): Qty {
    return new Qty(this.value.abs());
  }

  neg(): Qty {
    return new Qty(this.value.neg());
  }

  cmp(other: DecimalLike): number {
    return this.value.cmp(toDecimal(other));
  }

  eq(other: DecimalLike): boolean {
    return this.value.eq(toDecimal(other));
  }

  gt(other: DecimalLike): boolean {
    return this.value.gt(toDecimal(other));
  }

  gte(other: DecimalLike): boolean {
    return this.value.gte(toDecimal(other));
  }

  lt(other: DecimalLike): boolean {
    return this.value.lt(toDecimal(other));
  }

  lte(other: DecimalLike): boolean {
    return this.value.lte(toDecimal(other));
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  isPositive(): boolean {
    return this.value.isPositive();
  }

  toFixed(places: number): string {
    return this.value.toFixed(places);
  }

  toString(): string {
    return this.value.toFixed();
  }

  toNumberUnsafe(): number {
    return this.value.toNumber();
  }

  toJSON(): string {
    return this.toString();
  }
}

export class Money {
  readonly amount: Qty;
  readonly currency: string;

  constructor(amount: DecimalLike, currency = "USD") {
    this.amount = new Qty(amount);
    this.currency = currency;
  }

  private sameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyError(`currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }

  add(other: Money): Money {
    this.sameCurrency(other);
    return new Money(this.amount.add(other.amount), this.currency);
  }

  sub(other: Money): Money {
    this.sameCurrency(other);
    return new Money(this.amount.sub(other.amount), this.currency);
  }

  mul(factor: DecimalLike): Money {
    return new Money(this.amount.mul(factor), this.currency);
  }

  div(factor: DecimalLike): Money {
    return new Money(this.amount.div(factor), this.currency);
  }

  abs(): Money {
    return new Money(this.amount.abs(), this.currency);
  }

  neg(): Money {
    return new Money(this.amount.neg(), this.currency);
  }

  cmp(other: Money): number {
    this.sameCurrency(other);
    return this.amount.cmp(other.amount);
  }

  gte(other: Money): boolean {
    return this.cmp(other) >= 0;
  }

  gt(other: Money): boolean {
    return this.cmp(other) > 0;
  }

  lte(other: Money): boolean {
    return this.cmp(other) <= 0;
  }

  lt(other: Money): boolean {
    return this.cmp(other) < 0;
  }

  eq(other: Money): boolean {
    return this.currency === other.currency && this.amount.eq(other.amount);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isNegative(): boolean {
    return this.amount.isNegative();
  }

  toFixed(places = 2): string {
    return this.amount.toFixed(places);
  }

  toString(): string {
    return `${this.toFixed(2)} ${this.currency}`;
  }

  toJSON(): { amount: string; currency: string } {
    return { amount: this.amount.toString(), currency: this.currency };
  }
}

export interface InstrumentPrecision {
  priceDecimals: number;
  quantityDecimals: number;
  tickSize: string;
  lotSize: string;
  minQuantity: string;
}

export const DEFAULT_EQUITY_PRECISION: InstrumentPrecision = {
  priceDecimals: 2,
  quantityDecimals: 4,
  tickSize: "0.01",
  lotSize: "0.0001",
  minQuantity: "0.0001",
};

export const DEFAULT_FOREX_PRECISION: InstrumentPrecision = {
  priceDecimals: 5,
  quantityDecimals: 2,
  tickSize: "0.00001",
  lotSize: "1000",
  minQuantity: "1000",
};

export const DEFAULT_CRYPTO_PRECISION: InstrumentPrecision = {
  priceDecimals: 2,
  quantityDecimals: 8,
  tickSize: "0.01",
  lotSize: "0.00000001",
  minQuantity: "0.00000001",
};

export function roundToTick(price: DecimalLike, tickSize: DecimalLike): Qty {
  const tick = new Qty(tickSize);
  if (tick.lte(0)) throw new MoneyError("tick size must be positive");
  const p = new Qty(price);
  return new Qty(p.value.div(tick.value).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).mul(tick.value));
}

export function roundToLot(quantity: DecimalLike, lotSize: DecimalLike): Qty {
  const lot = new Qty(lotSize);
  if (lot.lte(0)) throw new MoneyError("lot size must be positive");
  const q = new Qty(quantity);
  return new Qty(q.value.div(lot.value).toDecimalPlaces(0, Decimal.ROUND_DOWN).mul(lot.value));
}

export function notional(price: DecimalLike, quantity: DecimalLike, currency = "USD"): Money {
  return new Money(new Qty(price).mul(quantity), currency);
}

export function riskDistance(entry: DecimalLike, stop: DecimalLike): Qty {
  return new Qty(entry).sub(stop).abs();
}
