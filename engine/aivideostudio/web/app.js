const STAGES = [
  ["research", "Research"],
  ["script", "Script"],
  ["storyboard", "Storyboard"],
  ["visuals", "Visuals"],
  ["voice", "Voice"],
  ["music", "Music"],
  ["editing", "Editing"],
  ["captions", "Captions"],
  ["thumbnail", "Thumbnail"],
  ["quality_review", "Quality review"],
  ["final_render", "Final render"],
];

const EXAMPLES = [
  "Create a 7-minute documentary about the history of Jamaica's sugar industry.",
  "Create a funny 60-second YouTube Short explaining why airplanes stay in the air.",
  "Create a cinematic fictional story about a fisherman who discovers something strange in the Caribbean.",
  "Create a faceless YouTube video explaining 10 ways AI can help small businesses.",
  "Create a 60-second educational video explaining why the sky appears blue.",
];

const state = {
  view: "new",
  projectId: null,
  jobId: null,
  setup: true,
  poll: null,
  form: {
    prompt: "",
    platform: "youtube",
    duration: "ai_decides",
    custom_seconds: 60,
    mode: "simple",
    usage_mode: "personal",
    max_budget: 0,
    visual_style: "",
    tone: "",
    voice_gender: "",
    caption_style: "youtube",
    research_depth: "standard",
    ai_disclosure: "automatic",
  },
};

const $ = (sel, el = document) => el.querySelector(sel);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.detail || j.message || msg;
    } catch {}
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;
}

function nav() {
  const items = [
    ["new", "New project"],
    ["projects", "Projects"],
    ["templates", "Templates"],
    ["assets", "Assets"],
    ["tasks", "Tasks"],
    ["settings", "Settings"],
    ["licenses", "Licenses & models"],
    ["system", "System status"],
  ];
  return items
    .map(
      ([id, label]) =>
        `<button class="nav-btn ${state.view === id || (id === "new" && state.view === "production") ? "active" : ""}" data-go="${id}">${label}</button>`
    )
    .join("");
}

function layout(main) {
  return `
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <img src="/icon.png" alt="AI Video Studio" />
        <div>
          <h1>AI Video Studio</h1>
          <p>Describe it. We produce it.</p>
        </div>
      </div>
      ${nav()}
      <div class="grow"></div>
      <button class="nav-btn" data-go="setup">Setup wizard</button>
    </aside>
    <main class="main">${main}</main>
  </div>`;
}

function seg(name, options, current) {
  return `<div class="seg">${options
    .map(
      ([v, l]) =>
        `<button type="button" data-field="${name}" data-value="${v}" class="${current === v ? "on" : ""}">${l}</button>`
    )
    .join("")}</div>`;
}

function newProject() {
  const f = state.form;
  return layout(`
    <div class="hero-kicker">NEW PROJECT</div>
    <h2>What do you want to create?</h2>
    <p class="lede">Describe the video in everyday language. You do not need to know anything about models, GPUs, or editing software.</p>
    <textarea class="prompt" id="prompt" placeholder="Create a 7-minute documentary about…">${escapeHtml(f.prompt)}</textarea>
    <div class="examples">${EXAMPLES.map((e) => `<button class="chip" data-ex="${encodeURIComponent(e)}">${e}</button>`).join("")}</div>
    <div class="row cols-3">
      <label class="field">Platform ${seg("platform", [
        ["youtube", "YouTube"],
        ["youtube_shorts", "YouTube Shorts"],
        ["tiktok", "TikTok"],
        ["both", "YouTube + TikTok"],
        ["custom", "Custom"],
      ], f.platform)}</label>
      <label class="field">Duration ${seg("duration", [
        ["ai_decides", "AI decides"],
        ["short", "Short"],
        ["1-3", "1–3 minutes"],
        ["5-10", "5–10 minutes"],
        ["10-20", "10–20 minutes"],
        ["custom", "Custom"],
      ], f.duration)}</label>
      <label class="field">Mode ${seg("mode", [
        ["simple", "Simple"],
        ["advanced", "Advanced"],
      ], f.mode)}</label>
    </div>
    ${f.duration === "custom" ? `<label class="field">Custom length (seconds)<input class="input" id="custom_seconds" type="number" min="15" value="${f.custom_seconds}"></label>` : ""}
    <div class="adv ${f.mode === "advanced" ? "show" : ""}">
      <div class="card">
        <h3>Advanced — still in plain language</h3>
        <div class="row cols-3">
          <label class="field">Voice ${seg("voice_gender", [["", "AI decides"], ["female", "Feminine"], ["male", "Masculine"]], f.voice_gender)}</label>
          <label class="field">Visual style ${seg("visual_style", [["", "AI decides"], ["cinematic", "Cinematic"], ["cartoon", "Cartoon"], ["motion-graphics", "Motion graphics"], ["realistic", "Realistic"]], f.visual_style)}</label>
          <label class="field">Project type ${seg("usage_mode", [["personal", "Personal"], ["commercial", "Commercial"]], f.usage_mode)}</label>
        </div>
        <div class="row cols-3">
          <label class="field">Caption style ${seg("caption_style", [["youtube", "YouTube"], ["tiktok", "TikTok"], ["shorts", "Shorts"], ["clean", "Clean"], ["dynamic", "Dynamic"]], f.caption_style)}</label>
          <label class="field">Research ${seg("research_depth", [["light", "Light"], ["standard", "Standard"], ["deep", "Deep"]], f.research_depth)}</label>
          <label class="field">Max spend (USD)<input class="input" id="max_budget" type="number" min="0" step="1" value="${f.max_budget}"></label>
        </div>
        <p class="muted">Local production is $0. The app will stop and ask before spending cloud credits.</p>
      </div>
    </div>
    <button class="primary" id="create">Create video</button>
  `);
}

function productionView(p, job) {
  const stages = STAGES.map(([id, label]) => {
    const active = job && job.stage === id;
    const done = job && (job.status === "COMPLETED" || stageDone(job.stage, id));
    const pct = active ? Math.max(8, job.progress || 0) : done ? 100 : 0;
    return `<div class="stage">
      <strong>${label}</strong>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <span class="badge ${done ? "ok" : active ? "warn" : ""}">${done ? "Done" : active ? "Working" : "Waiting"}</span>
    </div>`;
  }).join("");
  const err = job && job.error ? `<div class="error-box"><strong>Something went wrong.</strong><div>${escapeHtml(job.error)}</div>
    <details class="tech"><summary>Technical details</summary><pre class="log">${escapeHtml(job.logs || "")}</pre></details></div>` : "";
  return layout(`
    <div class="hero-kicker">PRODUCTION</div>
    <h2>${escapeHtml(p.name || "Your video")}</h2>
    <p class="lede">${escapeHtml(job?.current_activity || "The studio is working. You can leave this screen — progress is saved.")}</p>
    ${err}
    <div class="stage-list">${stages}</div>
    <div class="row cols-2" style="margin-top:18px">
      <div>
        <h3>Activity</h3>
        <pre class="log">${escapeHtml(job?.logs || "Waiting…")}</pre>
      </div>
      <div>
        <p class="muted">Job ${escapeHtml(job?.status || "")} · ${Math.round(job?.progress || 0)}%</p>
        <button class="ghost" data-act="pause">Pause</button>
        <button class="ghost" data-act="resume">Resume</button>
        <button class="ghost" data-act="cancel">Cancel</button>
        <button class="ghost" data-act="retry">Retry</button>
      </div>
    </div>
  `);
}

function reviewView(p) {
  const v = p.review || {};
  const findings = (v.findings || []).map(f => `
    <tr>
      <td><span class="badge ${f.severity === "CRITICAL" ? "err" : f.severity === "IMPORTANT" ? "warn" : ""}">${f.severity}</span></td>
      <td>${escapeHtml(f.reviewer || "")}</td>
      <td>${escapeHtml(f.problem || "")}<div class="muted">${escapeHtml(f.evidence || "")}</div></td>
      <td>${escapeHtml(f.recommended_fix || "")}</td>
    </tr>`).join("");
  const ready = p.status === "complete" || p.checkpoint === "complete";
  return layout(`
    <div class="hero-kicker">FINAL REVIEW</div>
    <h2>${escapeHtml(p.name)}</h2>
    <p class="lede">Executive producer: <strong>${escapeHtml(v.decision || "In progress")}</strong> — ${escapeHtml(v.summary || "")}</p>
    ${ready ? `<video class="player" controls src="/api/projects/${p.id}/file?kind=video"></video>` : `<div class="card">The video is still rendering.</div>`}
    <div class="card">
      <h3>Findings</h3>
      <table class="table"><thead><tr><th>Severity</th><th>Reviewer</th><th>Problem</th><th>Fix</th></tr></thead><tbody>${findings || "<tr><td colspan=4 class=muted>No findings yet.</td></tr>"}</tbody></table>
    </div>
    <div class="card">
      <h3>Tell the AI what you want changed</h3>
      <textarea class="prompt" id="change" style="min-height:90px" placeholder="Make the narrator sound more energetic."></textarea>
      <p>
        <button class="primary" id="request-changes">Request changes</button>
      </p>
      <p class="muted">Only the affected parts are rebuilt. Changing the voice does not regenerate visuals.</p>
    </div>
    <p>
      <button class="ghost" data-dl="video">Download video</button>
      <button class="ghost" data-dl="thumbnail">Download thumbnail</button>
      <button class="ghost" data-dl="captions">Download captions</button>
      <button class="ghost" id="open-folder">Show output folder</button>
    </p>
    <p class="muted">Videos are never published automatically. You upload them yourself.</p>
  `);
}

async function render() {
  try {
    if (state.view === "new") {
      document.getElementById("app").innerHTML = newProject();
    } else if (state.view === "production" && state.projectId) {
      const p = await api(`/api/projects/${state.projectId}`);
      const job = (p.jobs && p.jobs[0]) || null;
      if (job && job.status === "COMPLETED") {
        state.view = "review";
        return render();
      }
      document.getElementById("app").innerHTML = productionView(p, job);
    } else if (state.view === "review" && state.projectId) {
      const p = await api(`/api/projects/${state.projectId}`);
      document.getElementById("app").innerHTML = reviewView(p);
    } else if (state.view === "projects") {
      const rows = await api("/api/projects");
      document.getElementById("app").innerHTML = layout(`
        <div class="hero-kicker">PROJECTS</div><h2>Your productions</h2>
        <div class="grid">${rows.map(r => `
          <div class="card">
            <h3>${escapeHtml(r.name)}</h3>
            <p class="muted">${escapeHtml(r.platform)} · ${escapeHtml(r.status)} · ${escapeHtml(r.checkpoint)}</p>
            <button class="ghost" data-open="${r.id}">Open</button>
          </div>`).join("") || "<p class=muted>No projects yet.</p>"}</div>`);
    } else if (state.view === "templates") {
      const t = await api("/api/templates");
      document.getElementById("app").innerHTML = layout(`
        <div class="hero-kicker">TEMPLATES</div><h2>Start from a format</h2>
        <div class="grid">${t.templates.map(x => `
          <div class="card">
            <h3>${escapeHtml(x.name)}</h3>
            <p class="muted">${escapeHtml(x.prompt_hint)}</p>
            <button class="ghost" data-template='${JSON.stringify(x)}'>Use template</button>
          </div>`).join("")}</div>`);
    } else if (state.view === "assets") {
      const rows = await api("/api/assets");
      document.getElementById("app").innerHTML = layout(`
        <div class="hero-kicker">ASSETS</div><h2>Library</h2>
        <table class="table"><thead><tr><th>Name</th><th>Type</th><th>License</th><th>Created</th></tr></thead>
        <tbody>${rows.map(a => {
          let lic = "";
          try { lic = JSON.parse(a.license_json || "{}"); lic = lic.component || lic.status || ""; } catch {}
          return `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.category)}</td><td>${escapeHtml(String(lic))}</td><td>${escapeHtml(a.created_at)}</td></tr>`;
        }).join("") || "<tr><td colspan=4 class=muted>Nothing generated yet.</td></tr>"}</tbody></table>`);
    } else if (state.view === "tasks") {
      const jobs = await api("/api/jobs");
      document.getElementById("app").innerHTML = layout(`
        <div class="hero-kicker">TASKS</div><h2>Background jobs</h2>
        <table class="table"><thead><tr><th>Status</th><th>Stage</th><th>Progress</th><th>Activity</th></tr></thead>
        <tbody>${jobs.map(j => `<tr><td>${escapeHtml(j.status)}</td><td>${escapeHtml(j.stage || "")}</td><td>${Math.round(j.progress)}%</td><td>${escapeHtml(j.current_activity || "")}</td></tr>`).join("")}</tbody></table>`);
    } else if (state.view === "settings") {
      const s = await api("/api/settings");
      const fields = Object.entries(s.secrets).map(([k,v]) => `<label class="field">${k.replaceAll("_"," ")}<input class="input secret" data-secret="${k}" value="${escapeHtml(v)}" placeholder="Paste here — it is stored encrypted"></label>`).join("");
      document.getElementById("app").innerHTML = layout(`
        <div class="hero-kicker">SETTINGS</div><h2>AI providers</h2>
        <p class="lede">Keys stay on this computer, encrypted. They are never written into the project files that you share, and they are masked in logs.</p>
        <div class="card">${fields}<p><button class="primary" id="save-secrets">Save keys</button></p>
        <p class="muted">The studio works without any paid keys. Add keys only if you want optional cloud models.</p></div>`);
    } else if (state.view === "licenses") {
      const reg = await api("/api/licenses");
      document.getElementById("app").innerHTML = layout(`
        <div class="hero-kicker">LICENSES & MODELS</div>
        <h2>What this studio is allowed to use</h2>
        <p class="lede">Verified ${escapeHtml(reg.verified_date)}. A repository license is not the same as a model-weights license. Commercial projects block unknown, non-commercial, and unclear models unless you override after reading this screen.</p>
        <table class="table"><thead><tr><th>Component</th><th>Status</th><th>Repo license</th><th>Weights</th><th>Notes</th></tr></thead>
        <tbody>${reg.components.map(c => `<tr>
          <td><strong>${escapeHtml(c.component_name)}</strong><div class="muted">${escapeHtml(c.type)}</div></td>
          <td>${escapeHtml(c.status)}</td>
          <td>${escapeHtml(c.repository_license)}</td>
          <td>${escapeHtml(c.weights_license)}</td>
          <td>${escapeHtml(c.notes || "")}<div class="muted">Verified ${escapeHtml(c.verified_date)} · ${escapeHtml(c.verification_source || "")}</div></td>
        </tr>`).join("")}</tbody></table>`);
    } else if (state.view === "system") {
      const s = await api("/api/system");
      document.getElementById("app").innerHTML = layout(`
        <div class="hero-kicker">SYSTEM STATUS</div>
        <h2>This computer</h2>
        <p class="lede">${escapeHtml(s.hardware.plain_english)}</p>
        <div class="grid">
          <div class="card"><h3>Memory</h3><p>${s.hardware.ram_gb} GB · ${s.hardware.class_level}</p></div>
          <div class="card"><h3>Graphics</h3><p>${escapeHtml(s.hardware.gpu_name)}</p></div>
          <div class="card"><h3>Disk free</h3><p>${s.hardware.disk_free_gb} GB</p></div>
          <div class="card"><h3>Engines</h3><p>FFmpeg ${s.engines.ffmpeg ? "ready" : "missing"} · Voice ready · Ollama ${s.engines.ollama ? "on" : "off"}</p></div>
        </div>
        ${s.license_warnings.length ? `<div class="warn-box">${s.license_warnings.map(escapeHtml).join("<br>")}</div>` : ""}
      `);
    } else if (state.view === "setup") {
      const s = await api("/api/system");
      document.getElementById("app").innerHTML = layout(`
        <div class="hero-kicker">WELCOME</div>
        <h2>Let’s get your studio ready</h2>
        <div class="card"><h3>1. Check computer</h3><p>${escapeHtml(s.hardware.plain_english)}</p></div>
        <div class="card"><h3>2. Required components</h3>
          <p>FFmpeg: ${s.engines.ffmpeg ? "installed" : "needs install"} · Voice engine: ready · Python: ready</p>
        </div>
        <div class="card"><h3>3. Optional models</h3>
          <p>No huge model downloads are required. Optional cloud and ComfyUI connections live in Settings.</p>
        </div>
        <div class="card"><h3>4. Test video</h3>
          <p>We’ll make a short educational video so you can see that research, voice, music, captions, and render all work.</p>
          <button class="primary" id="selftest">Run test video</button>
        </div>
      `);
    }
  } catch (err) {
    document.getElementById("app").innerHTML = layout(`<div class="error-box">${escapeHtml(err.message)}</div>`);
  }
  bind();
}

function stageDone(current, id) {
  const ids = STAGES.map(s => s[0]);
  return ids.indexOf(id) < ids.indexOf(current) || current === "complete";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bind() {
  document.querySelectorAll("[data-go]").forEach((b) =>
    b.addEventListener("click", () => {
      state.view = b.dataset.go;
      stopPoll();
      render();
    })
  );
  document.querySelectorAll("[data-field]").forEach((b) =>
    b.addEventListener("click", () => {
      state.form[b.dataset.field] = b.dataset.value;
      const p = document.getElementById("prompt");
      if (p) state.form.prompt = p.value;
      render();
    })
  );
  document.querySelectorAll("[data-ex]").forEach((b) =>
    b.addEventListener("click", () => {
      state.form.prompt = decodeURIComponent(b.dataset.ex);
      render();
    })
  );
  const create = document.getElementById("create");
  if (create) create.addEventListener("click", onCreate);
  const selftest = document.getElementById("selftest");
  if (selftest) selftest.addEventListener("click", onSelftest);
  const save = document.getElementById("save-secrets");
  if (save) save.addEventListener("click", onSaveSecrets);
  const ch = document.getElementById("request-changes");
  if (ch) ch.addEventListener("click", onChanges);
  document.querySelectorAll("[data-open]").forEach((b) =>
    b.addEventListener("click", () => {
      state.projectId = b.dataset.open;
      state.view = "review";
      startPoll();
      render();
    })
  );
  document.querySelectorAll("[data-template]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = JSON.parse(b.dataset.template);
      state.form.platform = t.platform;
      state.form.duration = t.duration;
      state.form.prompt = t.prompt_hint;
      state.form.visual_style = t.visual_style;
      state.form.caption_style = t.caption_style;
      state.form.research_depth = t.research_depth;
      state.view = "new";
      render();
    })
  );
  document.querySelectorAll("[data-act]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!state.jobId) return;
      await api(`/api/jobs/${state.jobId}/${b.dataset.act}`, { method: "POST" });
    })
  );
  document.querySelectorAll("[data-dl]").forEach((b) =>
    b.addEventListener("click", () => {
      window.location = `/api/projects/${state.projectId}/file?kind=${b.dataset.dl}`;
    })
  );
}

async function onCreate() {
  const prompt = document.getElementById("prompt").value.trim();
  if (!prompt) return;
  const custom = document.getElementById("custom_seconds");
  const budget = document.getElementById("max_budget");
  const body = {
    prompt,
    platform: state.form.platform,
    duration: state.form.duration,
    custom_seconds: custom ? Number(custom.value) : state.form.custom_seconds,
    mode: state.form.mode,
    usage_mode: state.form.usage_mode,
    settings: {
      max_budget: budget ? Number(budget.value) : state.form.max_budget,
      visual_style: state.form.visual_style,
      caption_style: state.form.caption_style,
      research_depth: state.form.research_depth,
      voice_gender: state.form.voice_gender || undefined,
      tone: state.form.tone,
      ai_disclosure: state.form.ai_disclosure,
    },
  };
  const created = await api("/api/projects", { method: "POST", body });
  const job = await api(`/api/projects/${created.id}/produce`, { method: "POST" });
  state.projectId = created.id;
  state.jobId = job.job_id;
  state.view = "production";
  startPoll();
  render();
}

async function onSelftest() {
  const r = await api("/api/setup/selftest", { method: "POST" });
  state.projectId = r.project_id;
  state.jobId = r.job_id;
  state.view = "production";
  startPoll();
  render();
}

async function onSaveSecrets() {
  for (const el of document.querySelectorAll(".secret")) {
    if (el.value && !el.value.includes("••••")) {
      await api("/api/settings/secrets", { method: "POST", body: { name: el.dataset.secret, value: el.value } });
    }
  }
  alert("Saved on this computer.");
}

async function onChanges() {
  const instruction = document.getElementById("change").value.trim();
  if (!instruction) return;
  const r = await api(`/api/projects/${state.projectId}/changes`, { method: "POST", body: { instruction } });
  state.jobId = r.job_id;
  state.view = "production";
  startPoll();
  render();
}

function startPoll() {
  stopPoll();
  state.poll = setInterval(render, 1500);
}

function stopPoll() {
  if (state.poll) clearInterval(state.poll);
  state.poll = null;
}

async function boot() {
  try {
    const s = await api("/api/system");
    if (!s.setup_complete) state.view = "setup";
  } catch {}
  render();
}

boot();
