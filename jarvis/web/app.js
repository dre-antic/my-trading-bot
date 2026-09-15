const views = document.querySelectorAll(".view");
const navs = document.querySelectorAll("button.nav");
const transcript = document.getElementById("transcript");
const prompt = document.getElementById("prompt");
const observeBanner = document.getElementById("observe-banner");
const haltBanner = document.getElementById("halt-banner");

function show(name) {
  views.forEach((v) => v.classList.toggle("on", v.id === "view-" + name));
  navs.forEach((b) => b.classList.toggle("on", b.dataset.view === name));
  if (name !== "chat") loadView(name);
}

navs.forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

document.querySelectorAll("[data-act]").forEach((b) => {
  b.addEventListener("click", async () => {
    const act = b.dataset.act;
    if (act === "stop") await post("/api/stop");
    if (act === "pause") await post("/api/pause");
    if (act === "resume") await post("/api/resume");
    if (act === "observe-stop") await post("/api/observe/stop");
    await refreshStatus();
  });
});

document.getElementById("composer").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = prompt.value.trim();
  if (!text) return;
  addBubble("user", text);
  prompt.value = "";
  addBubble("jarvis", "Working…");
  const result = await post("/api/chat", { text });
  const last = transcript.querySelector(".bubble.jarvis:last-child");
  last.textContent = result.reply || pretty(result);
  if (result.mission) renderMissionInline(result.mission);
  await refreshStatus();
});

function addBubble(who, text) {
  const div = document.createElement("div");
  div.className = "bubble " + who;
  div.textContent = text;
  transcript.appendChild(div);
  transcript.scrollTop = transcript.scrollHeight;
}

function renderMissionInline(mission) {
  const wrap = document.createElement("div");
  wrap.className = "card";
  const steps = (mission.events || []).map((ev) => `<li class="done">${esc(ev.message)}</li>`).join("");
  wrap.innerHTML = `<div class="row"><h3>${esc(mission.objective)}</h3><span class="pill">${esc(mission.status)}</span></div>
    <ul class="steps">${steps}</ul>`;
  transcript.appendChild(wrap);
}

async function loadView(name) {
  const el = document.getElementById("view-" + name);
  if (name === "missions") {
    const items = await get("/api/missions");
    el.innerHTML = heading("Missions") + items.map((m) => card(m.objective, m.status, m.id)).join("") || empty("No missions yet.");
  }
  if (name === "projects") {
    const items = await get("/api/projects");
    el.innerHTML = heading("Projects") + items.map((p) => card(p.name, p.current_state || p.purpose, p.root_path)).join("") || empty("Nothing in Projects yet.");
  }
  if (name === "history") {
    const items = await get("/api/audit");
    el.innerHTML = heading("History") + items.map((a) => card(a.action, `${a.result || ""} · ${a.risk || ""}`, a.ts)).join("") || empty("No history yet.");
  }
  if (name === "activity") {
    const data = await get("/api/activity");
    el.innerHTML = heading("Live activity") + (data.notifications || []).map((n) => card(n.title, n.body, n.kind)).join("") || empty("Quiet for now.");
  }
  if (name === "system") {
    const data = await get("/api/system");
    const s = data.inspect || {};
    el.innerHTML = heading("System doctor") + `<div class="card">
      <p>${esc(s.os || "")} · ${esc((s.machine) || "")}</p>
      <p class="muted">Python: ${esc((s.python && s.python.running_version) || s.python || "")}</p>
      <p class="muted">This is the local JARVIS runtime on this computer. Cloud AI is optional.</p>
      <p class="muted">Projects folder: ${esc(s.workspace)}</p>
      <p class="muted">Hardware check from the cloud builder: not claimed. ${esc(s.note || "")}</p>
      ${(s.issues || []).map((i) => `<div class="card"><strong>${esc(i.what)}</strong><p>${esc(i.why)}</p><p class="muted">${esc(i.how)}</p></div>`).join("")}
      <button id="fix-low">Fix the easy things</button></div>`;
    document.getElementById("fix-low")?.addEventListener("click", async () => {
      await post("/api/system/fix");
      loadView("system");
    });
  }
  if (name === "memory") {
    const items = await get("/api/memory");
    el.innerHTML = heading("Memory") + `<p class="muted">You can look at, change, or delete what I remember. Secrets are never stored here.</p>` +
      items.map((m) => card(m.title, m.body, m.kind)).join("") || empty("Empty.");
  }
  if (name === "permissions") {
    const items = await get("/api/permissions");
    el.innerHTML = heading("Waiting for you") + items.map(approvalCard).join("") || empty("Nothing needs approval.");
    el.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", async () => {
      await post(`/api/permissions/${b.dataset.approve}/approve`);
      loadView("permissions");
    }));
    el.querySelectorAll("[data-reject]").forEach((b) => b.addEventListener("click", async () => {
      await post(`/api/permissions/${b.dataset.reject}/reject`);
      loadView("permissions");
    }));
  }
  if (name === "providers") {
    const items = await get("/api/providers");
    el.innerHTML = heading("Providers") + items.map((p) => card(p.name, `${p.health} · ${p.cost} · ${p.authentication}`, p.capabilities.join(", "))).join("");
  }
  if (name === "settings") {
    const s = await get("/api/status");
    el.innerHTML = heading("Settings") + `<div class="card">
      <p>Mode</p>
      ${["JARVIS", "ASSIST", "SAFE", "OBSERVE"].map((m) => `<button data-mode="${m}">${m}</button>`).join(" ")}
      <p class="muted">Workspace: ${esc(s.workspace)}</p>
      <p class="muted">Automatic spending: $0. Paid services always stop and ask.</p>
      <p class="muted">JARVIS runs on this Mac. Cloud AI off still allows files, missions, memory, and the local builder.</p>
    </div>`;
    el.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", async () => {
      await post("/api/mode", { mode: b.dataset.mode });
      refreshStatus();
    }));
  }
}

function approvalCard(item) {
  return `<div class="card approval">
    <div class="row"><h3>${esc(item.action)}</h3><span class="pill">${esc(item.risk)}</span></div>
    <p><strong>Target</strong> ${esc(item.target)}</p>
    <p><strong>Why</strong> ${esc(item.why)}</p>
    <p><strong>Risk</strong> ${esc(item.risk)}</p>
    <p><strong>Cost</strong> ${esc(item.cost)}</p>
    <p><strong>Can this be undone?</strong> ${esc(item.reversibility)}</p>
    ${item.data_json && item.data_json !== "{}" ? `<p><strong>Data</strong> ${esc(item.data_json)}</p>` : ""}
    <button data-approve="${item.id}">Approve</button>
    <button data-reject="${item.id}">Reject</button>
  </div>`;
}

function heading(t) { return `<h2>${t}</h2>`; }
function empty(t) { return `<p class="muted">${t}</p>`; }
function card(title, body, meta) {
  return `<div class="card"><div class="row"><h3>${esc(title)}</h3><span class="pill">${esc(meta || "")}</span></div><p>${esc(body || "")}</p></div>`;
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function pretty(obj) { try { return JSON.stringify(obj, null, 2); } catch { return String(obj); } }

async function get(url) {
  const res = await fetch(url);
  return res.json();
}
async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function refreshStatus() {
  const s = await get("/api/status");
  document.getElementById("mode-label").textContent = (s.mode || "") + " mode";
  const cloud = s.cloud_ai && s.cloud_ai.available;
  const label = document.getElementById("runtime-label");
  if (label) {
    label.textContent = cloud
      ? "This computer · local runtime · cloud AI on (approved)"
      : "This computer · local runtime · cloud AI off (local tools still work)";
  }
  observeBanner.hidden = !s.observe;
  const halted = s.halt && s.halt !== "NONE";
  if (haltBanner) {
    haltBanner.hidden = !halted;
    const haltText = s.halt === "PAUSE_SAFELY" ? "JARVIS is paused. Work is saved." : "JARVIS is stopped. Nothing new will run.";
    const textNode = haltBanner.childNodes[0];
    if (textNode) textNode.textContent = haltText + " ";
  }
  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) resumeBtn.hidden = !halted;
}

refreshStatus();
