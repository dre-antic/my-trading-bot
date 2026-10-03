import { Qty } from "./money";

/** Reject limit/stop prices more than 10% away from last — retail analog of a price reasonability check. */
export const FAT_FINGER_PCT = "10";

export function fatFingerDeviationPct(last: string, proposed: string): string {
  const l = new Qty(last);
  if (l.isZero()) return "100";
  return new Qty(proposed).sub(l).abs().div(l).mul(100).toFixed(4);
}

export function isFatFingerPrice(last: string | undefined, proposed: string | undefined): boolean {
  if (!last || !proposed) return false;
  return new Qty(fatFingerDeviationPct(last, proposed)).gt(FAT_FINGER_PCT);
}
