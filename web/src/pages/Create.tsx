import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export function CreatePage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    topic: "How Jamaican music influenced the world",
    format: "documentary",
    durationSec: 25,
    audience: "General YouTube audience",
    tone: "Cinematic documentary",
    language: "en",
    voice: "Natural male",
    visualStyle: "Archival cinematic",
    musicStyle: "documentary",
    qualityLevel: "draft",
    budgetUsd: 0,
    approvalMode: "approve_final",
    aspectRatio: "16:9",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ jobId: string }>("/api/jobs", { method: "POST", body: JSON.stringify(form) });
      nav(`/jobs/${r.jobId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Create video</h1>
      <p className="lede">Enter a topic. The Video Director researches, writes, voices, assembles, and quality-checks a publish-ready MP4. Default budget is $0.</p>
      <div className="grid">
        <label className="wide">
          Topic
          <textarea value={form.topic} onChange={(e) => set("topic", e.target.value)} />
        </label>
        <label>
          Format
          <select value={form.format} onChange={(e) => set("format", e.target.value)}>
            {["documentary", "youtube_long", "youtube_shorts", "tiktok", "instagram_reels", "educational", "storytelling", "news_explainer", "list", "historical", "faceless"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Length (seconds)
          <input type="number" value={form.durationSec} onChange={(e) => set("durationSec", Number(e.target.value))} />
        </label>
        <label>
          Audience
          <input value={form.audience} onChange={(e) => set("audience", e.target.value)} />
        </label>
        <label>
          Tone
          <input value={form.tone} onChange={(e) => set("tone", e.target.value)} />
        </label>
        <label>
          Language
          <input value={form.language} onChange={(e) => set("language", e.target.value)} />
        </label>
        <label>
          Voice
          <select value={form.voice} onChange={(e) => set("voice", e.target.value)}>
            <option>Natural male</option>
            <option>Natural female</option>
            <option>Neutral</option>
          </select>
        </label>
        <label>
          Visual style
          <input value={form.visualStyle} onChange={(e) => set("visualStyle", e.target.value)} />
        </label>
        <label>
          Music style
          <select value={form.musicStyle} onChange={(e) => set("musicStyle", e.target.value)}>
            <option>documentary</option>
            <option>cinematic</option>
            <option>upbeat</option>
          </select>
        </label>
        <label>
          Quality
          <select value={form.qualityLevel} onChange={(e) => set("qualityLevel", e.target.value)}>
            <option value="draft">draft (720p, old-Mac friendly)</option>
            <option value="standard">standard</option>
            <option value="high">high</option>
          </select>
        </label>
        <label>
          Budget USD
          <input type="number" value={form.budgetUsd} onChange={(e) => set("budgetUsd", Number(e.target.value))} />
        </label>
        <label>
          Automation
          <select value={form.approvalMode} onChange={(e) => set("approvalMode", e.target.value)}>
            <option value="full_automatic">Full automatic</option>
            <option value="approve_before_render">Approve before rendering</option>
            <option value="approve_final">Approve final video</option>
            <option value="approve_expensive">Approve only expensive operations</option>
          </select>
        </label>
        <label>
          Format / aspect
          <select value={form.aspectRatio} onChange={(e) => set("aspectRatio", e.target.value)}>
            <option>16:9</option>
            <option>9:16</option>
            <option>1:1</option>
          </select>
        </label>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="actions">
        <button className="primary" disabled={busy} onClick={generate}>
          {busy ? "Starting…" : "Generate"}
        </button>
      </div>
    </>
  );
}
