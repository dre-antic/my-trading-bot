import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 16);

export function newId(prefix: string): string {
  return `${prefix}_${nano()}`;
}

export const ids = {
  user: () => newId("usr"),
  session: () => newId("ses"),
  device: () => newId("dev"),
  strategy: () => newId("str"),
  strategyVersion: () => newId("stv"),
  document: () => newId("doc"),
  rule: () => newId("rul"),
  experiment: () => newId("exp"),
  deployment: () => newId("dep"),
  instrument: () => newId("ins"),
  dataSource: () => newId("mds"),
  account: () => newId("acct"),
  credential: () => newId("crd"),
  position: () => newId("pos"),
  order: () => newId("ord"),
  fill: () => newId("fil"),
  candidate: () => newId("can"),
  review: () => newId("rev"),
  riskEvent: () => newId("rsk"),
  backtest: () => newId("bt"),
  run: () => newId("run"),
  regime: () => newId("reg"),
  agent: () => newId("agt"),
  aiRun: () => newId("air"),
  evidence: () => newId("evd"),
  journal: () => newId("jnl"),
  alert: () => newId("alr"),
  audit: () => newId("aud"),
  system: () => newId("sys"),
  notice: () => newId("ntf"),
  snapshot: () => newId("snp"),
  constitution: () => newId("con"),
  job: () => newId("job"),
  clientOrder: () => newId("clord"),
};
