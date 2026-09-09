import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

const STAGES = [
  "research",
  "fact_check",
  "script",
  "storyboard",
  "assets",
  "voice",
  "music",
  "captions",
  "assembly",
  "qc",
  "render",
  "final_review",
];

export function JobPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  async function refresh() {
    if (!id) return;
    const r = await api<any>(`/api/jobs/${id}`);
    setData(r);
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 1500);
    return () => clearInterval(t);
  }, [id]);

  async function act(path: string) {
    setErr("");
    try {
      await api(`/api/jobs/${id}/${path}`, { method: "POST", body: "{}" });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (!data) return <p>Loading…</p>;
  const m = data.manifest;
  const status = data.status as string;
  const doneIdx = STAGES.indexOf(m.stage);

  return (
    <>
      <h1>{m.request?.topic}</h1>
      <div className="meta">
        <span>Status {status}</span>
        <span>Stage {m.stage}</span>
        <span>Cost ${Number(data.spendUsd ?? 0).toFixed(4)}</span>
        {m.qc && (
          <span>
            Quality <b>{m.qc.overall}</b>/100
          </span>
        )}
      </div>
      <div className="actions">
        <button className="ghost" onClick={() => act("pause")}>
          Pause
        </button>
        <button className="ghost" onClick={() => act("resume")}>
          Resume
        </button>
        <button className="danger" onClick={() => act("cancel")}>
          Cancel
        </button>
        <button className="primary" onClick={() => act("approve")}>
          Approve
        </button>
      </div>
      {err && <p className="err">{err}</p>}

      <div className="card">
        <h3>Pipeline</h3>
        <div className="pipeline">
          {STAGES.map((s, i) => {
            const done = status === "complete" || i < doneIdx || (m.stage === "awaiting_approval" && i <= STAGES.length);
            const run = s === m.stage && status === "running";
            return (
              <div className="stage" key={s}>
                <div>
                  <span className={`dot ${run ? "run" : done ? "done" : status === "failed" && s === m.stage ? "fail" : ""}`} />
                  {s.replace("_", " ")}
                </div>
                <div>{run ? "working…" : done ? "✓" : "…"}</div>
                <div></div>
              </div>
            );
          })}
        </div>
      </div>

      {m.qc && (
        <div className="card">
          <div className="row">
            <div>
              <div className="score">{m.qc.overall}</div>
              <div>Overall QC</div>
            </div>
            <div className="mono">
              FACTUAL {m.qc.factual}
              {"\n"}AUDIO {m.qc.audio}
              {"\n"}VISUAL {m.qc.visual}
              {"\n"}PACING {m.qc.pacing}
              {"\n"}CAPTIONS {m.qc.captions}
            </div>
          </div>
          {m.qc.issues?.map((i: any, n: number) => (
            <p key={n}>
              {i.severity}: {i.message}
            </p>
          ))}
        </div>
      )}

      {(m.renderPath || m.previewPath) && (
        <div className="card">
          <h3>VIDEO READY</h3>
          <video controls src={`/api/jobs/${id}/media/video`} />
          {m.youtube?.thumbnailPath && (
            <p>
              <img alt="thumbnail" src={`/api/jobs/${id}/media/thumb`} style={{ maxWidth: 360 }} />
            </p>
          )}
        </div>
      )}

      {m.script && (
        <div className="card">
          <h3>Script</h3>
          <p>
            <b>{m.script.title}</b> — {m.script.concept}
          </p>
          <pre>{m.script.finalNarration || m.script.draft}</pre>
        </div>
      )}

      {m.research && (
        <div className="card">
          <h3>Sources</h3>
          {m.research.sources.map((s: any) => (
            <p key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>{" "}
              · tier {s.tier} · {s.license}
            </p>
          ))}
        </div>
      )}

      {m.scenes && (
        <div className="card">
          <h3>Storyboard</h3>
          {m.scenes.map((s: any) => (
            <p key={s.id}>
              <b>{s.id}</b> {s.estimatedDurationSec?.toFixed?.(1)}s — {s.narration}
            </p>
          ))}
        </div>
      )}

      {m.youtube && (
        <div className="card">
          <h3>YouTube package</h3>
          <pre>{JSON.stringify(m.youtube, null, 2)}</pre>
        </div>
      )}

      {m.warnings?.length > 0 && (
        <div className="card">
          <h3>Warnings</h3>
          {m.warnings.map((w: string, i: number) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
    </>
  );
}
