/* NiveshLens frontend - talks to /api/* only. All dynamic text is escaped before insertion. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (n, d = 2) => (n == null ? "-" : "Rs " + Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (n, d = 2) => (n == null ? "-" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }));
const sgn = (n, d = 2) => (n == null ? "-" : (n > 0 ? "+" : "") + Number(n).toFixed(d));
const cls = (n) => (n > 0 ? "up" : n < 0 ? "down" : "mute");
const badgeCls = (r) => ({ "Strong Buy": "b-sb", Buy: "b-b", Hold: "b-h", Reduce: "b-r", Sell: "b-s" }[r] || "b-h");
const scoreColor = (s) => (s >= 62 ? "var(--up)" : s >= 46 ? "var(--amber)" : s >= 34 ? "#ff9b66" : "var(--down)");

let state = { horizon: "", symbol: null, last: null };

async function api(path) {
  const r = await fetch((window.NIVESH_API_BASE || "") + path, { credentials: "omit", referrerPolicy: "no-referrer" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || j.error || r.statusText);
  return j;
}

/* ---------------------------------------------------------------- tabs */
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  $$("#tabs button").forEach((x) => x.classList.toggle("on", x === b));
  $$(".tab").forEach((t) => t.classList.toggle("on", t.id === "tab-" + b.dataset.tab));
  if (b.dataset.tab === "picks") loadPicks();
  if (b.dataset.tab === "market") loadMarket();
});

/* ---------------------------------------------------------------- header status */
async function health() {
  try {
    const h = await api("/api/health");
    $("#mstatusText").textContent = h.market.ist + " - " + h.market.state.toUpperCase();
    $(".dot").classList.toggle("open", h.market.state === "open");
    if (h.demo_mode === "on") showBanner("Demo mode is ON: all data is synthetic sample data, not real market data.");
  } catch (e) { $("#mstatusText").textContent = "API offline"; }
}
function showBanner(t) { const b = $("#banner"); b.hidden = !t; b.textContent = t || ""; }

/* ---------------------------------------------------------------- search */
const POPULAR = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "ITC", "BHARTIARTL", "LT", "SUNPHARMA", "TATASTEEL", "MARUTI"];
$("#chips").innerHTML = POPULAR.map((s) => `<button class="chip" data-s="${s}">${s}</button>`).join("");
$("#chips").addEventListener("click", (e) => { const s = e.target.dataset.s; if (s) analyze(s); });

let tmr;
$("#q").addEventListener("input", () => {
  clearTimeout(tmr);
  tmr = setTimeout(async () => {
    const q = $("#q").value.trim();
    if (!q) return ($("#suggest").hidden = true);
    try {
      const r = (await api("/api/search?q=" + encodeURIComponent(q))).results;
      const ul = $("#suggest");
      const custom = /^[A-Za-z0-9&.\-^]{1,20}$/.test(q) && !r.some((x) => x.symbol === q.toUpperCase())
        ? `<li data-s="${esc(q.toUpperCase())}"><span>Analyze "${esc(q.toUpperCase())}" (NSE)</span><small>custom symbol</small></li>` : "";
      ul.innerHTML = r.map((x) => `<li data-s="${esc(x.symbol)}"><span><b>${esc(x.symbol)}</b> ${esc(x.name)}</span><small>${esc(x.sector)}</small></li>`).join("") + custom;
      ul.hidden = !ul.innerHTML;
    } catch (_) {}
  }, 150);
});
$("#suggest").addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) analyze(li.dataset.s); });
$("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") analyze($("#q").value.trim()); });
$("#go").addEventListener("click", () => analyze($("#q").value.trim()));
document.addEventListener("click", (e) => { if (!e.target.closest(".search")) $("#suggest").hidden = true; });
$("#hz").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  $$("#hz button").forEach((x) => x.classList.toggle("on", x === b));
  state.horizon = b.dataset.h;
  if (state.symbol) analyze(state.symbol);
});

/* ---------------------------------------------------------------- analyze */
async function analyze(sym, horizon) {
  if (!sym) return;
  sym = sym.toUpperCase().replace(/\.NS$/, "");
  $$("#tabs button").forEach((x) => x.classList.toggle("on", x.dataset.tab === "analyze"));
  $$(".tab").forEach((t) => t.classList.toggle("on", t.id === "tab-analyze"));
  $("#suggest").hidden = true; $("#q").value = sym;
  state.symbol = sym;
  const h = horizon ?? state.horizon;
  $("#result").innerHTML = `<div class="loading">Analysing ${esc(sym)}: pulling prices, fundamentals, news and global cues...</div>`;
  try {
    const d = await api(`/api/analyze/${encodeURIComponent(sym)}` + (h ? `?horizon=${h}` : ""));
    state.last = d;
    history.replaceState(null, '', '#/' + encodeURIComponent(sym));
    render(d);
  } catch (e) {
    $("#result").innerHTML = `<div class="err"><b>Couldn't analyse ${esc(sym)}.</b> ${esc(e.message)}<br><span class="mute">Check the NSE symbol (e.g. M&amp;M, BAJAJ-AUTO) and try again.</span></div>`;
  }
}

function ring(score) {
  const r = 60, c = 2 * Math.PI * r, off = c * (1 - score / 100);
  return `<div class="ring"><svg width="140" height="140"><circle cx="70" cy="70" r="${r}" fill="none" stroke="#1d2a38" stroke-width="11"/>
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="${scoreColor(score)}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>
  <div class="n"><div><b>${score.toFixed(0)}</b><span>/ 100</span></div></div></div>`;
}

function render(d) {
  const p = d.plan, q = d.data_quality;
  const warn = q.live ? "" : `<div class="err" style="background:#2a2010;border-color:#6b4d12;color:#ffd98a;margin-bottom:18px"><b>Sample data in use.</b> Live ${["prices", "fundamentals", "news", "macro"].filter((k) => q[k] !== "live").join(", ")} could not be fetched, so some or all inputs are synthetic. Do not trade on this output.</div>`;
  const isLong = p.direction === "long", isAvoid = p.direction === "avoid";
  const lvl = (lab, v, pct, c = "") => `<div class="lv ${c}"><div class="label">${lab}</div><div class="v">${inr(v)}</div>${pct != null ? `<div class="p ${cls(pct)}">${sgn(pct, 1)}%</div>` : ""}</div>`;
  const planTitle = isLong ? "Trade plan" : isAvoid ? "Exit / avoid levels" : "Conditional plan (neutral view)";
  const maxH = Math.max(...d.horizon_scores.map((h) => h.score));

  $("#result").innerHTML = `
  ${warn}
  <div class="card hero">
    <div>
      <div class="label">${esc(d.sector)} - NSE: ${esc(d.symbol)}</div>
      <h1>${esc(d.name)}</h1>
      <div class="sub">${esc(d.market.note)} - last close ${esc(d.as_of)}</div>
      <div class="price">${inr(d.price)}<small class="${cls(d.change)}">${sgn(d.change)} (${sgn(d.change_pct)}%)</small></div>
      <div class="meta">
        <span>52W <b>${num(d.stats.lo52, 0)} - ${num(d.stats.hi52, 0)}</b></span><span>RSI <b>${d.stats.rsi}</b></span><span>P/E <b>${d.stats.pe ?? "-"}</b></span>
        <span>ROE <b>${d.stats.roe_pct ?? "-"}%</b></span><span>Beta <b>${d.stats.beta ?? "-"}</b></span><span>Mkt cap <b>${d.stats.market_cap_cr ? "Rs " + num(d.stats.market_cap_cr, 0) + " Cr" : "-"}</b></span>
      </div>
    </div>
    <div class="scorebox">
      ${ring(d.score)}
      <div><span class="badge ${badgeCls(d.rating)}">${esc(d.rating)}</span>
        <div class="conf">Model confidence ${d.confidence}%<div class="confbar"><i style="width:${d.confidence}%"></i></div></div>
        <div class="conf">View horizon<br><b style="color:var(--txt)">${esc(p.horizon_label)}</b></div></div>
    </div>
  </div>

  <div class="grid g2 stack">
    <div class="card plan">
      <div class="label">${planTitle}</div>
      <div class="action" style="color:${isLong ? "var(--up)" : isAvoid ? "var(--down)" : "var(--amber)"}">${esc(p.timing)}</div>
      <div class="hznote">Time horizon: ${esc(p.horizon_label)} - review by ${esc(p.review_by)}</div>
      <div class="levels">
        <div class="lv"><div class="label">${isAvoid ? "Sell / reduce zone" : "Entry zone"}</div><div class="v" style="font-size:16px">${num(p.entry_low)} - ${num(p.entry_high)}</div><div class="p mute">Rs, per share</div></div>
        ${lvl(isAvoid ? "Invalidated above" : "Stop-loss", p.stop_loss, p.stop_pct, "sl")}
        ${lvl(isAvoid ? "Downside 1" : "Target 1", p.target1, p.target1_pct, "t")}
        ${lvl(isAvoid ? "Downside 2" : "Target 2", p.target2, p.target2_pct, "t")}
      </div>
      <div class="meta"><span>Risk-reward T1 <b>${p.risk_reward}:1</b></span><span>T2 <b>${p.risk_reward_t2}:1</b></span><span>Support <b>${num(p.support)}</b></span><span>Resistance <b>${num(p.resistance)}</b></span></div>
      ${p.notes.length ? `<ul class="notes">${p.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      ${isAvoid ? "" : `<div class="sizer">
        <label>Capital (Rs)<input id="cap" type="number" value="500000" min="1000" step="10000"></label>
        <label>Risk per trade %<input id="rk" type="number" value="1" min="0.1" max="5" step="0.1"></label>
        <div class="out" id="qty"></div></div>`}
    </div>
    <div class="card">
      <h3>Score by time horizon</h3>
      <div class="grid g2" style="grid-template-columns:1fr 1fr;gap:12px">
        ${d.horizon_scores.map((h) => `<div class="lv hz ${h.key === p.horizon ? "sel" : ""}" data-h="${h.key}">
          <div class="label">${esc(h.label)}</div><div class="s" style="color:${scoreColor(h.score)}">${h.score.toFixed(0)}</div>
          <div class="bar"><i style="width:${h.score}%;background:${scoreColor(h.score)}"></i></div>
          <div class="p mute">${esc(h.span)} - ${esc(h.rating)}</div></div>`).join("")}
      </div>
      <p class="mute" style="font-size:13px;margin:12px 0 0">Same inputs, different weights: short horizons lean on technicals and news; long horizons lean on fundamentals and risk. Click a card to re-plan.</p>
    </div>
  </div>

  <div class="card stack"><h3>Price, trend and trade levels</h3>
    <div class="chartwrap"><canvas id="chart"></canvas><div class="tip" id="tip"></div></div>
    <div class="legend"><span><i style="background:#e7edf3"></i>Close</span><span><i style="background:#f3b63f"></i>20-DMA</span><span><i style="background:#6aa9ff"></i>50-DMA</span><span><i style="background:#c28bff"></i>200-DMA</span>
    <span><i style="background:var(--up)"></i>Targets</span><span><i style="background:var(--down)"></i>Stop</span><span><i style="background:#8a9bb0"></i>Support / resistance</span></div></div>

  <div class="card stack"><h3>Why this rating</h3>
    <p class="lead">${esc(d.narrative.headline)}</p>
    ${d.narrative.ai_note ? `<div class="ainote"><span class="label">AI analyst note</span>${esc(d.narrative.ai_note)}</div>` : ""}
    <div class="pn"><div><h4 class="up">What's working</h4><ul>${(d.positives.length ? d.positives : ["No strong positives identified."]).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div><h4 class="down">What's against it</h4><ul>${(d.negatives.length ? d.negatives : ["No major negatives identified."]).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
    <h4 class="label" style="margin:18px 0 6px">Factor-by-factor</h4><ul class="why">${d.narrative.why.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <h4 class="label" style="margin:18px 0 6px">What would change the view</h4><ul class="why">${d.narrative.watch.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
  </div>

  <div class="card stack"><h3>Score breakdown <span class="mute" style="font:12px var(--mono)">weights for ${esc(p.horizon_label)}</span></h3>
    ${d.breakdown.map((b) => `<div class="factor"><div class="fh"><span class="name">${esc(b.label)}</span>
      <div class="fbar"><i style="width:${b.score}%;background:${scoreColor(b.score)}"></i></div>
      <span class="sc" style="color:${scoreColor(b.score)}">${b.score.toFixed(0)}</span><span class="wt">${Math.round(b.weight * 100)}% wt - ${sgn(b.contribution, 1)} pts</span><span class="car">&#9656;</span></div>
      <div class="sigs">${b.signals.map((s) => `<div class="sg"><span class="ico" style="background:${s.stance === "bullish" ? "var(--up)" : s.stance === "bearish" ? "var(--down)" : "#4a5b70"}"></span>
        <span>${esc(s.name)}</span><span class="v">${esc(s.value)}</span><span class="d">${esc(s.detail)}</span><span class="pt ${cls(s.points)}">${sgn(s.points, 1)}</span></div>`).join("")}</div></div>`).join("")}
  </div>

  <div class="grid g2 stack">
    <div class="card"><h3>News & sentiment</h3>
      <div class="meta" style="margin:-6px 0 8px"><span>Company tone <b class="${cls(d.news_summary.company)}">${sgn(d.news_summary.company)}</b></span><span>Sector <b class="${cls(d.news_summary.sector)}">${sgn(d.news_summary.sector)}</b></span><span>Market <b class="${cls(d.news_summary.market)}">${sgn(d.news_summary.market)}</b></span><span>${d.news_summary.n} items</span></div>
      <div class="news">${d.news.map((n) => `<div class="nw"><span class="scope">${esc(n.scope)}</span><div>
        <div class="t">${n.link ? `<a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a>` : esc(n.title)}</div>
        <div class="m"><span class="tag ${n.label}">${esc(n.label)} ${sgn(n.polarity)}</span>${n.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}${esc(n.source)}</div></div></div>`).join("") || '<p class="mute">No recent headlines.</p>'}</div>
    </div>
    <div class="card"><h3>Global & macro backdrop</h3>
      <div class="regime"><span class="label">Market regime</span><b class="${cls(d.macro.regime)}">${sgn(d.macro.regime)}</b><span class="label">Sector tailwind</span><b class="${cls(d.macro.sector_impact)}">${sgn(d.macro.sector_impact)}</b></div>
      ${macroTable(d.macro.board)}
    </div>
  </div>
  <p class="mute" style="font-size:12.5px;margin-top:18px">${esc(d.disclaimer)}</p>`;

  $$(".fh").forEach((h) => h.addEventListener("click", () => h.parentElement.classList.toggle("open")));
  $$(".hz[data-h]").forEach((h) => h.addEventListener("click", () => analyze(d.symbol, h.dataset.h)));
  setupSizer(p);
  requestAnimationFrame(() => drawChart(d));
}

function macroTable(board) {
  const keys = ["nifty", "banknifty", "vix", "sp500", "nasdaq", "nikkei", "brent", "gold", "usdinr", "dxy", "us10y"];
  return `<table style="width:100%;border-collapse:collapse;font:12.5px var(--mono)"><tr class="mute"><td></td><td align="right">Last</td><td align="right">1D</td><td align="right">5D</td><td align="right">20D</td></tr>` +
    keys.filter((k) => board[k]).map((k) => { const b = board[k];
      return `<tr style="border-top:1px solid var(--line)"><td style="padding:7px 0;font-family:var(--sans)">${esc(b.label)}</td><td align="right">${num(b.last)}</td><td align="right" class="${cls(b.chg1d)}">${sgn(b.chg1d)}%</td><td align="right" class="${cls(b.chg5d)}">${sgn(b.chg5d)}%</td><td align="right" class="${cls(b.chg20d)}">${sgn(b.chg20d)}%</td></tr>`; }).join("") + "</table>";
}

function setupSizer(p) {
  const cap = $("#cap"), rk = $("#rk"), out = $("#qty");
  if (!cap) return;
  const calc = () => {
    const risk = (cap.value * rk.value) / 100, per = Math.abs(p.entry - p.stop_loss);
    const qty = per > 0 ? Math.floor(risk / per) : 0, val = qty * p.entry;
    out.innerHTML = `Max loss <b>${inr(risk, 0)}</b> - Buy <b>${qty}</b> shares (${inr(val, 0)}, ${(val / cap.value * 100).toFixed(0)}% of capital)`;
  };
  cap.addEventListener("input", calc); rk.addEventListener("input", calc); calc();
}

/* ---------------------------------------------------------------- chart */
function drawChart(d) {
  const cv = $("#chart"); if (!cv) return;
  const ch = d.chart, p = d.plan, dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext("2d"); g.scale(dpr, dpr);
  const padL = 8, padR = 74, padT = 10, padB = 44, volH = 40;
  const n = ch.close.length, cw = W - padL - padR, chH = H - padT - padB - volH;
  const levels = [p.entry, p.stop_loss, p.target1, p.target2, p.support, p.resistance].filter((x) => x != null);
  const all = [...ch.close, ...ch.high, ...ch.low, ...ch.sma200.filter(Boolean), ...levels];
  let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.04; lo -= pad; hi += pad;
  const x = (i) => padL + (i / (n - 1)) * (cw * 0.86), y = (v) => padT + (1 - (v - lo) / (hi - lo)) * chH;
  g.clearRect(0, 0, W, H); g.font = "11px IBM Plex Mono, monospace";
  // grid + y labels
  g.strokeStyle = "#1a2635"; g.fillStyle = "#6e8099"; g.lineWidth = 1;
  for (let i = 0; i <= 5; i++) { const v = lo + ((hi - lo) * i) / 5, yy = y(v); g.beginPath(); g.moveTo(padL, yy); g.lineTo(W - padR, yy); g.stroke(); g.fillText(num(v, 0), W - padR + 6, yy + 4); }
  // x labels
  [0, 0.25, 0.5, 0.75, 1].forEach((f) => { const i = Math.round(f * (n - 1)); g.fillText(ch.dates[i].slice(2, 7), Math.min(x(i), W - padR - 30), H - padB - volH + 18 + 2); });
  // volume
  const vmax = Math.max(...ch.volume);
  ch.volume.forEach((v, i) => { g.fillStyle = ch.close[i] >= (ch.open[i] ?? ch.close[i]) ? "#35d39a44" : "#ff6b6b44"; const h = (v / vmax) * volH; g.fillRect(x(i) - 1, H - 6 - h, 2, h); });
  // area
  const grad = g.createLinearGradient(0, padT, 0, padT + chH); grad.addColorStop(0, "#e7edf322"); grad.addColorStop(1, "#e7edf300");
  g.beginPath(); ch.close.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v)))); g.lineTo(x(n - 1), padT + chH); g.lineTo(x(0), padT + chH); g.closePath(); g.fillStyle = grad; g.fill();
  const line = (arr, col, w = 1.3) => { g.beginPath(); let st = false; arr.forEach((v, i) => { if (v == null) return; st ? g.lineTo(x(i), y(v)) : (g.moveTo(x(i), y(v)), (st = true)); }); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
  line(ch.sma200, "#c28bff", 1.2); line(ch.sma50, "#6aa9ff", 1.2); line(ch.sma20, "#f3b63f", 1.2); line(ch.close, "#e7edf3", 1.8);
  // levels
  const lvl = (v, col, label) => { if (v == null) return; const yy = y(v); g.setLineDash([5, 4]); g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x(n - 1), yy); g.lineTo(W - padR, yy); g.stroke(); g.setLineDash([]);
    g.strokeStyle = col + "55"; g.setLineDash([2, 5]); g.beginPath(); g.moveTo(padL, yy); g.lineTo(x(n - 1), yy); g.stroke(); g.setLineDash([]);
    g.fillStyle = col; g.fillText(label + " " + num(v, 0), x(n - 1) + 6, yy - 3); };
  const bear = p.direction === "avoid";
  lvl(p.target2, "#35d39a", bear ? "D2" : "T2"); lvl(p.target1, "#35d39a", bear ? "D1" : "T1"); lvl(p.stop_loss, "#ff6b6b", bear ? "INV" : "SL");
  lvl(p.entry, "#f3b63f", "ENTRY"); lvl(p.resistance, "#8a9bb0", "RES"); lvl(p.support, "#8a9bb0", "SUP");
  // hover
  const tip = $("#tip");
  cv.onmousemove = (e) => { const r = cv.getBoundingClientRect(); const mx = e.clientX - r.left; const i = Math.max(0, Math.min(n - 1, Math.round(((mx - padL) / (cw * 0.86)) * (n - 1))));
    tip.style.display = "block"; tip.style.left = Math.min(mx + 12, W - 170) + "px"; tip.style.top = "12px";
    tip.innerHTML = `${esc(ch.dates[i])}<br>Close <b>${num(ch.close[i])}</b><br>H ${num(ch.high[i])} L ${num(ch.low[i])}`; };
  cv.onmouseleave = () => (tip.style.display = "none");
}
window.addEventListener("resize", () => state.last && $("#chart") && drawChart(state.last));

/* ---------------------------------------------------------------- picks */
async function loadPicks() {
  const el = $("#picks");
  if (el.dataset.loaded) return;
  el.innerHTML = `<div class="loading">Scanning 45 large-caps (first run takes a little while)...</div>`;
  try {
    const d = await api("/api/picks?limit=12");
    el.dataset.loaded = "1";
    $("#picksMeta").textContent = `${d.scanned} stocks scanned. Buys need score of 62+ and risk-reward of 1.2+.` + (d.live ? "" : " (Includes sample data.)");
    const card = (r) => `<div class="pick" data-s="${esc(r.symbol)}"><div class="r1"><div><h4>${esc(r.name)}</h4><small>${esc(r.symbol)} - ${esc(r.sector)}</small></div>
      <div><div class="sc" style="color:${scoreColor(r.score)}">${r.score.toFixed(0)}</div><span class="badge ${badgeCls(r.rating)}" style="font-size:12px;padding:2px 9px">${esc(r.rating)}</span></div></div>
      <div class="kv"><div><span>Price</span>${num(r.price)}</div><div><span>Target 1</span><b class="up">${num(r.target1)}</b> <small>${sgn(r.target1_pct, 1)}%</small></div><div><span>Stop</span><b class="down">${num(r.stop_loss)}</b></div></div>
      <div class="why"><b style="color:var(--txt)">${esc(r.timing)}</b> - ${esc(r.horizon)} - R:R ${r.risk_reward}</div><div class="why" style="margin-top:6px">${esc(r.why)}</div></div>`;
    el.innerHTML = `<h3 class="h3sec" style="margin-top:0">Best buy setups</h3><div class="pickgrid">${d.top_buys.map(card).join("") || '<p class="mute">No stock currently clears both the score and risk-reward bars.</p>'}</div>
      <h3 class="h3sec">Weak / avoid</h3><div class="pickgrid">${d.avoid.map(card).join("") || '<p class="mute">Nothing flagged.</p>'}</div>`;
    el.onclick = (e) => { const c = e.target.closest(".pick"); if (c) analyze(c.dataset.s); };
  } catch (e) { el.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

/* ---------------------------------------------------------------- market */
function spark(a, up) {
  const w = 180, h = 34, mn = Math.min(...a), mx = Math.max(...a);
  const pts = a.map((v, i) => `${(i / (a.length - 1)) * w},${h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 6)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${up ? "var(--up)" : "var(--down)"}" stroke-width="1.6"/></svg>`;
}
async function loadMarket() {
  const el = $("#market");
  try {
    const d = await api("/api/market");
    $("#marketMeta").innerHTML = `${esc(d.status.note)} - Risk regime <b class="${cls(d.regime)}">${sgn(d.regime)}</b> (${d.drivers.map(esc).join("; ")})${d.source === "demo" ? " - <b class='amber'>sample data</b>" : ""}`;
    const groups = {};
    Object.values(d.items).forEach((i) => (groups[i.group] ||= []).push(i));
    el.innerHTML = Object.entries(groups).map(([g, arr]) => `<div class="grouphead">${esc(g)}</div><div class="tiles">${arr.map((i) =>
      `<div class="tile"><div class="nm">${esc(i.label)}</div><div class="lt">${num(i.last)}</div>
       <div class="cg"><span class="${cls(i.chg1d)}">${sgn(i.chg1d)}% 1D</span> <span class="mute">- 5D</span> <span class="${cls(i.chg5d)}">${sgn(i.chg5d)}%</span></div>${spark(i.spark, i.chg20d >= 0)}</div>`).join("")}</div>`).join("");
  } catch (e) { el.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

health();
const hashSym = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
if (/^[A-Za-z0-9&.\-^]{1,20}$/.test(hashSym)) analyze(hashSym);
