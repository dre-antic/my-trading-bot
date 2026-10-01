export type EmergencyAction =
  | "STOP_NEW_TRADES"
  | "CANCEL_OPEN_ORDERS"
  | "PAUSE_STRATEGY"
  | "STOP_AUTOMATION"
  | "CLOSE_ALL_POSITIONS";

export interface EmergencyRequest {
  action: EmergencyAction;
  confirmPhrase: string;
  userId: string;
}

export const EMERGENCY_PHRASES: Record<EmergencyAction, string> = {
  STOP_NEW_TRADES: "STOP NEW TRADES",
  CANCEL_OPEN_ORDERS: "CANCEL OPEN ORDERS",
  PAUSE_STRATEGY: "PAUSE STRATEGY",
  STOP_AUTOMATION: "STOP AUTOMATION",
  CLOSE_ALL_POSITIONS: "CLOSE ALL POSITIONS",
};

export function authorizeEmergency(req: EmergencyRequest): { ok: true } | { ok: false; reason: string } {
  const expected = EMERGENCY_PHRASES[req.action];
  if (req.confirmPhrase !== expected) {
    return { ok: false, reason: `Confirmation phrase must be exactly "${expected}".` };
  }
  if (req.action === "CLOSE_ALL_POSITIONS" && req.confirmPhrase !== "CLOSE ALL POSITIONS") {
    return { ok: false, reason: "Close-all requires explicit confirmation." };
  }
  return { ok: true };
}
