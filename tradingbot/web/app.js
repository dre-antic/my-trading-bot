const state = {
  selectedId: null,
  strategies: [],
  examples: [],
  desk: null,
  lastScan: null,
};

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { detail: text };
  }
  if (!response.ok) {
    const detail = body && body.detail ? body.detail : response.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return body;
}

function money(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function renderAccount() {
  const cash = state.desk?.broker?.cash ?? 10000;
  const positions = state.desk?.broker?.positions?.length ?? 0;
  $("account-status").textContent = `Paper cash ${money(cash)} USDT · ${positions} open`;
}

function renderExamples() {
  const root = $("examples");
  root.innerHTML = "";
  state.examples.forEach((example) => {
    const button = document.createElement("button");
    button.className = "chip";
    button.type = "button";
    button.textContent = `Load “${example.name}”`;
    button.addEventListener("click", async () => {
      $("style-text").value = example.text;
      await compileText(example.text, `${example.slug}.md`);
    });
    root.appendChild(button);
  });
}

function renderStyles() {
  const root = $("style-list");
  root.innerHTML = "";
  state.strategies.forEach((item) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = item.id === state.selectedId ? "active" : "";
    button.innerHTML = `<strong>${item.name}</strong><br /><span class="sub">${item.criteria.symbols.join(", ")} · ${item.criteria.timeframe}</span>`;
    button.addEventListener("click", () => selectStrategy(item.id));
    li.appendChild(button);
    root.appendChild(li);
  });
}

function selectStrategy(id) {
  state.selectedId = id;
  const item = state.strategies.find((row) => row.id === id);
  $("scan-live").disabled = !item;
  $("scan-demo").disabled = !item;
  renderStyles();
  renderCriteria(item);
}

function renderCriteria(item) {
  const ticket = $("criteria-ticket");
  const lede = $("criteria-lede");
  if (!item) {
    lede.textContent = "Nothing compiled yet. After you upload a style, this ticket is what the bot is allowed to trade.";
    ticket.className = "ticket empty";
    ticket.textContent = "Waiting for a style document.";
    return;
  }
  lede.textContent = "This is the contract the bot will use. A trade is allowed only when these compiled checks pass.";
  const c = item.criteria;
  const scan = state.lastScan?.evaluation;
  const entryHtml = (c.entry.conditions || []).map((rule) => ruleLine(rule, scan?.entry_results)).join("");
  const exitHtml = (c.exit.conditions || []).map((rule) => ruleLine(rule, scan?.exit_results)).join("");
  const warnings = (item.warnings || []).map((w) => `<div class="warn">${escapeHtml(w)}</div>`).join("");
  const uncompiled = (c.uncompiled || []).map((w) => `<div class="warn">Uncompiled: ${escapeHtml(w)}</div>`).join("");
  ticket.className = "ticket";
  ticket.innerHTML = `
    <h3>${escapeHtml(item.name)}</h3>
    <div>${escapeHtml(c.symbols.join(", "))} · ${escapeHtml(c.timeframe)} · confidence ${Math.round((c.confidence || 0) * 100)}%</div>
    <ul class="english">${item.english.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    <h3>Entry · ${c.entry.logic === "all" ? "every rule" : "any rule"}</h3>
    ${entryHtml || "<div class='warn'>No entry rules compiled.</div>"}
    <h3>Exit · ${c.exit.logic === "any" ? "any rule" : "every rule"}</h3>
    ${exitHtml || "<div class='muted'>No indicator exits. Stops/targets still apply if present.</div>"}
    <h3>Risk</h3>
    <div>${c.risk.quote_amount} USDT · max ${c.risk.max_open_positions} position(s)
      ${c.risk.stop_loss_pct != null ? ` · SL ${c.risk.stop_loss_pct}%` : ""}
      ${c.risk.take_profit_pct != null ? ` · TP ${c.risk.take_profit_pct}%` : ""}
    </div>
    ${warnings}${uncompiled}
  `;
}

function ruleLine(rule, results) {
  const result = (results || []).find((row) => row.id === rule.id);
  const mark = result ? (result.passed ? "pass" : "fail") : "";
  const extra = result ? result.detail : "";
  return `<div class="rule"><span>${escapeHtml(rule.description)}</span><span class="${mark}">${escapeHtml(extra)}</span></div>`;
}

function renderScan(result) {
  const box = $("scan-result");
  if (!result) {
    box.className = "scan empty";
    box.textContent = "No scan yet.";
    return;
  }
  const ev = result.evaluation;
  box.className = `scan ${result.action}`;
  const checks = (ev.entry_results || [])
    .map((row) => `<div class="rule"><span>${escapeHtml(row.description)}</span><span class="${row.passed ? "pass" : "fail"}">${row.passed ? "PASS" : "WAIT"} · ${escapeHtml(row.detail)}</span></div>`)
    .join("");
  box.innerHTML = `
    <div class="sub">${result.demo ? "Demo tape" : "Live market"} · ${escapeHtml(result.action.toUpperCase())}</div>
    <div class="price">${escapeHtml(ev.symbol)} ${money(ev.price)}</div>
    <p>${escapeHtml(result.message)}</p>
    ${checks}
  `;
}

function renderFills() {
  const root = $("fills");
  const trades = state.desk?.trades || [];
  root.innerHTML = "";
  if (!trades.length) {
    root.innerHTML = "<li class='sub'>No paper fills yet.</li>";
    return;
  }
  trades.forEach((trade) => {
    const li = document.createElement("li");
    const pnl = trade.pnl == null ? "" : ` · P&L ${money(trade.pnl)}`;
    li.innerHTML = `<span class="${trade.side}">${trade.side.toUpperCase()}</span> ${escapeHtml(trade.symbol)} @ ${money(trade.price)} · ${money(trade.quote_amount)} USDT${pnl}<br /><span class="sub">${escapeHtml((trade.reason || []).join(" · "))}</span>`;
    root.appendChild(li);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function refreshDesk() {
  state.desk = await api("/api/desk");
  state.strategies = state.desk.strategies || [];
  renderAccount();
  renderStyles();
  renderFills();
  if (state.selectedId) {
    const current = state.strategies.find((row) => row.id === state.selectedId);
    renderCriteria(current);
  }
}

async function compileText(text, filename) {
  const saved = await api("/api/strategies/from-text", {
    method: "POST",
    body: JSON.stringify({ text, filename: filename || "pasted.txt" }),
  });
  await refreshDesk();
  selectStrategy(saved.id);
}

async function uploadFile(file) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/strategies/upload", { method: "POST", body });
  const saved = await response.json();
  if (!response.ok) {
    throw new Error(saved.detail || "Upload failed");
  }
  await refreshDesk();
  selectStrategy(saved.id);
}

function showError(err) {
  const box = $("scan-result");
  box.className = "scan";
  box.innerHTML = `<div class="error">${escapeHtml(err.message || err)}</div>`;
}

function bind() {
  const drop = $("drop");
  const file = $("file");
  ["dragenter", "dragover"].forEach((eventName) => {
    drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      drop.classList.add("drag");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      drop.classList.remove("drag");
    });
  });
  drop.addEventListener("drop", async (event) => {
    const next = event.dataTransfer.files[0];
    if (next) {
      try { await uploadFile(next); } catch (err) { showError(err); }
    }
  });
  file.addEventListener("change", async () => {
    if (file.files[0]) {
      try { await uploadFile(file.files[0]); } catch (err) { showError(err); }
    }
  });
  $("compile-btn").addEventListener("click", async () => {
    try { await compileText($("style-text").value); } catch (err) { showError(err); }
  });
  $("scan-live").addEventListener("click", () => runScan(false));
  $("scan-demo").addEventListener("click", () => runScan(true));
  $("reset-desk").addEventListener("click", async () => {
    await api("/api/desk/reset", { method: "POST", body: "{}" });
    state.lastScan = null;
    renderScan(null);
    await refreshDesk();
  });
}

async function runScan(demo) {
  if (!state.selectedId) return;
  try {
    const result = await api(`/api/strategies/${state.selectedId}/scan?demo=${demo ? "true" : "false"}`, {
      method: "POST",
      body: "{}",
    });
    state.lastScan = result;
    renderScan(result);
    await refreshDesk();
  } catch (err) {
    showError(err);
  }
}

async function boot() {
  bind();
  state.examples = await api("/api/examples");
  renderExamples();
  await refreshDesk();
  if (state.strategies[0]) selectStrategy(state.strategies[0].id);
}

boot().catch(showError);
