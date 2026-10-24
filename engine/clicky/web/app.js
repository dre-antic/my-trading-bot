const STAKES = [10, 25, 50, 100, 250];
const PROMPTS = ["What should I do?", "Show my book", "What's the price?", "How does this work?"];

const state = {
  symbol: "BTC",
  usd: 25,
  data: null,
  pendingSide: null,
};

const $ = (id) => document.getElementById(id);

function money(value) {
  const abs = Math.abs(value);
  const formatted = abs >= 1000 ? abs.toLocaleString(undefined, { maximumFractionDigits: 0 }) : abs.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${value < 0 ? "-" : ""}$${formatted}`;
}

function tone(value) {
  if (value > 0.005) return "up";
  if (value < -0.005) return "down";
  return "";
}

function clickSound(kind) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = kind === "buy" ? 420 : kind === "sell" ? 220 : 320;
  gain.gain.setValueAtTime(0.07, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.06);
}

function haptic(ms = 12) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function toast(text) {
  const node = $("toast");
  node.textContent = text;
  node.hidden = false;
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => {
    node.hidden = true;
  }, 2400);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || "Request failed");
  }
  return payload;
}

function renderMarkets(markets) {
  const root = $("markets");
  root.innerHTML = "";
  for (const market of markets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `market${market.symbol === state.symbol ? " on" : ""}`;
    button.dataset.symbol = market.symbol;
    const change = market.change_24h == null ? "—" : `${market.change_24h >= 0 ? "+" : ""}${market.change_24h.toFixed(1)}%`;
    button.innerHTML = `<b>${market.symbol}</b><em>${money(market.price)}</em><em>${change}</em>`;
    button.addEventListener("click", async () => {
      state.symbol = market.symbol;
      clickSound("ask");
      haptic();
      await refresh();
    });
    root.appendChild(button);
  }
}

function renderWallet(book) {
  $("equity").textContent = money(book.equity);
  $("cash").textContent = money(book.cash);
  $("upnl").textContent = money(book.unrealized);
  $("upnl").className = tone(book.unrealized);
}

function renderTake(advice, source) {
  const face = document.querySelector(".orb-face");
  face.dataset.mood = advice.action;
  $("headline").textContent = `${advice.symbol} ${advice.action}`;
  $("take-meta").textContent = `${advice.action.toUpperCase()} · ${advice.confidence}% conviction · RSI ${advice.rsi ?? "n/a"}`;
  $("take-body").textContent = advice.reason;
  $("source-pill").textContent = source === "live" ? "PAPER · LIVE" : "PAPER · DEMO";
}

function renderStakes() {
  const root = $("stakes");
  root.innerHTML = "";
  for (const usd of STAKES) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip${usd === state.usd ? " on" : ""}`;
    chip.textContent = `$${usd}`;
    chip.addEventListener("click", () => {
      state.usd = usd;
      renderStakes();
    });
    root.appendChild(chip);
  }
}

function renderChat(messages) {
  const log = $("chat-log");
  log.innerHTML = "";
  if (!messages.length) {
    log.innerHTML = `<p class="empty">Tap ASK or send a line. Clicky keeps it short.</p>`;
    return;
  }
  for (const message of messages) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${message.role}`;
    bubble.textContent = message.text;
    log.appendChild(bubble);
  }
  log.scrollTop = log.scrollHeight;
}

function renderBook(book) {
  const lots = $("lots");
  const clicks = $("clicks");
  if (!book.lots.length) {
    lots.innerHTML = `<p class="empty">No bags. Cash ${money(book.cash)}.</p>`;
  } else {
    lots.innerHTML = book.lots
      .map(
        (lot) => `<article class="lot"><span>${lot.symbol}</span><strong>${lot.qty.toFixed(6)} · ${money(lot.value)}</strong><span>Avg ${money(lot.avg_price)} · P&amp;L ${money(lot.pnl)}</span></article>`,
      )
      .join("");
  }
  if (!book.clicks.length) {
    clicks.innerHTML = `<p class="empty">No taps yet.</p>`;
  } else {
    clicks.innerHTML = book.clicks
      .map(
        (click) => `<article class="click"><span>${click.side.toUpperCase()} ${click.symbol}</span><strong>${money(click.usd)} @ ${money(click.price)}</strong><span>${click.note}</span></article>`,
      )
      .join("");
  }
}

function apply(data) {
  state.data = data;
  renderMarkets(data.markets);
  renderWallet(data.book);
  renderTake(data.advice, data.source);
  renderChat(data.book.messages);
  renderBook(data.book);
}

async function refresh() {
  apply(await api(`/api/state?symbol=${state.symbol}`));
}

function openPanel(name) {
  $("panel-chat").hidden = name !== "chat";
  $("panel-book").hidden = name !== "book";
  document.querySelectorAll(".dock-btn").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.tab === (name === "home" ? "home" : name));
  });
}

function closePanels() {
  openPanel("home");
}

function think(on) {
  $("orb").classList.toggle("is-think", on);
}

async function ask(message) {
  think(true);
  try {
    const data = await api("/api/ask", { method: "POST", body: { message, symbol: state.symbol } });
    apply(data);
    toast(data.reply);
    return data;
  } finally {
    think(false);
  }
}

function confirmClick(side) {
  const market = state.data.markets.find((item) => item.symbol === state.symbol);
  state.pendingSide = side;
  $("confirm-kicker").textContent = "Paper tap";
  $("confirm-title").textContent = `${side === "buy" ? "Buy" : "Sell"} $${state.usd} of ${state.symbol}?`;
  $("confirm-body").textContent = `${state.symbol} is ${money(market.price)}. This only moves the fake wallet.`;
  $("sheet-confirm").hidden = false;
}

async function submitClick() {
  const side = state.pendingSide;
  $("sheet-confirm").hidden = true;
  if (!side) return;
  clickSound(side);
  haptic(18);
  try {
    const data = await api("/api/click", {
      method: "POST",
      body: { side, symbol: state.symbol, usd: state.usd },
    });
    apply(data);
    toast(data.fill.note);
  } catch (error) {
    toast(error.message);
  } finally {
    state.pendingSide = null;
  }
}

function wire() {
  renderStakes();
  $("prompts").innerHTML = "";
  for (const prompt of PROMPTS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = prompt;
    chip.addEventListener("click", async () => {
      openPanel("chat");
      await ask(prompt);
    });
    $("prompts").appendChild(chip);
  }

  $("orb").addEventListener("click", async () => {
    clickSound("ask");
    haptic();
    openPanel("chat");
    await ask("What should I do?");
  });
  $("ask").addEventListener("click", async () => {
    clickSound("ask");
    haptic();
    openPanel("chat");
    await ask("What should I do?");
  });
  $("buy").addEventListener("click", () => confirmClick("buy"));
  $("sell").addEventListener("click", () => confirmClick("sell"));
  $("confirm-cancel").addEventListener("click", () => {
    $("sheet-confirm").hidden = true;
    state.pendingSide = null;
  });
  $("confirm-go").addEventListener("click", submitClick);
  $("tab-home").addEventListener("click", closePanels);
  $("tab-chat").addEventListener("click", () => openPanel("chat"));
  $("tab-book").addEventListener("click", () => openPanel("book"));
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", closePanels);
  });
  $("chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("chat-input");
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    await ask(message);
  });
  $("reset").addEventListener("click", async () => {
    apply(await api(`/api/reset?symbol=${state.symbol}`, { method: "POST" }));
    toast("Paper wallet reset.");
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

wire();
refresh().catch((error) => toast(error.message));
