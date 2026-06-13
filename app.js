/* VirtuBuildr — BIM Modeling Estimator
 * Parametric engine. All productivity figures are editable assumptions and
 * should be calibrated against your firm's historical project data.
 */

// Base modeling productivity at LOD 300, standard complexity:
// hours required per 1,000 ft² of gross floor area, per discipline.
const DISCIPLINES = [
  { id: "arch", label: "Architectural", rate: 8.0, on: true },
  { id: "struct", label: "Structural", rate: 6.0, on: true },
  { id: "mech", label: "Mechanical (HVAC)", rate: 7.0, on: true },
  { id: "elec", label: "Electrical", rate: 5.0, on: false },
  { id: "plumb", label: "Plumbing", rate: 4.0, on: false },
  { id: "fire", label: "Fire Protection", rate: 3.0, on: false },
  { id: "site", label: "Site / Civil", rate: 3.5, on: false },
];

const CURRENCY = {
  USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", INR: "₹",
};

const STORAGE_KEY = "virtubuildr.estimate.v1";
const $ = (id) => document.getElementById(id);

let lastResult = null;

/* ---------- build discipline chips ---------- */
function buildChips() {
  const wrap = $("disciplines");
  wrap.innerHTML = "";
  DISCIPLINES.forEach((d) => {
    const label = document.createElement("label");
    label.className = "chip" + (d.on ? " active" : "");
    label.innerHTML =
      `<span class="dot"></span>${d.label}` +
      `<input type="checkbox" data-id="${d.id}" ${d.on ? "checked" : ""}>`;
    const cb = label.querySelector("input");
    cb.addEventListener("change", () => {
      label.classList.toggle("active", cb.checked);
      recalc();
    });
    wrap.appendChild(label);
  });
}

function selectedDisciplines() {
  return [...document.querySelectorAll("#disciplines input:checked")].map(
    (cb) => cb.dataset.id
  );
}

/* ---------- core calculation ---------- */
function calculate() {
  const areaRaw = parseFloat($("area").value) || 0;
  const areaToFt2 = parseFloat($("areaUnit").value); // 1 for ft², 10.7639 for m²
  const areaFt2 = areaRaw * areaToFt2;
  const kSqft = areaFt2 / 1000;

  const projectMult = parseFloat($("projectType").value);
  const lodMult = parseFloat($("lod").value);
  const sourceMult = parseFloat($("source").value);
  const complexityMult = parseFloat($("complexity").value);
  const rushMult = parseFloat($("rush").value);
  const contingency = (parseFloat($("contingency").value) || 0) / 100;

  const rate = parseFloat($("rate").value) || 0;
  const team = Math.max(1, parseInt($("team").value, 10) || 1);
  const hoursPerDay = Math.max(1, parseFloat($("hoursPerDay").value) || 1);

  const factor = projectMult * lodMult * sourceMult * complexityMult;
  const active = selectedDisciplines();

  // Per-discipline modeling hours
  const lines = [];
  let modelingHours = 0;
  DISCIPLINES.forEach((d) => {
    if (!active.includes(d.id)) return;
    const hrs = kSqft * d.rate * factor;
    modelingHours += hrs;
    lines.push({ label: d.label, hours: hrs });
  });

  // Coordination / clash detection overhead — scales with multi-trade scope
  const coordRate = active.length >= 2 ? 0.08 + 0.03 * active.length : 0;
  const coordHours = modelingHours * Math.min(coordRate, 0.3);

  // QA / setup overhead
  const qaHours = modelingHours * 0.12;

  const subtotal = modelingHours + coordHours + qaHours;
  const contingencyHours = subtotal * contingency;
  const preRush = subtotal + contingencyHours;
  const totalHours = preRush * rushMult;

  const cost = totalHours * rate;
  const days = totalHours / (team * hoursPerDay);

  return {
    areaFt2, lines, modelingHours, coordHours, qaHours,
    contingencyHours: contingencyHours * rushMult,
    totalHours, cost, days, rate,
    currency: $("currency").value,
    activeCount: active.length,
  };
}

/* ---------- formatting ---------- */
function fmtMoney(n, cur) {
  const sym = CURRENCY[cur] || "$";
  return sym + Math.round(n).toLocaleString();
}
function fmtHours(n) {
  return Math.round(n).toLocaleString() + " h";
}
function fmtDuration(days) {
  if (days <= 0) return "—";
  if (days < 1) return "<1 day";
  const weeks = days / 5; // working days/week
  if (days < 10) return `${Math.ceil(days)} days`;
  return `${weeks.toFixed(1)} wks (${Math.ceil(days)}d)`;
}

/* ---------- render ---------- */
function recalc() {
  const r = calculate();
  lastResult = r;

  $("totalCost").textContent = r.cost > 0 ? fmtMoney(r.cost, r.currency) : "—";
  $("totalHours").textContent = r.totalHours > 0 ? fmtHours(r.totalHours) : "—";
  $("duration").textContent = fmtDuration(r.days);

  const body = $("breakdownBody");
  body.innerHTML = "";

  const addRow = (label, hours, cls = "") => {
    const tr = document.createElement("tr");
    if (cls) tr.className = cls;
    const cost = hours * r.rate;
    tr.innerHTML =
      `<td>${label}</td><td>${fmtHours(hours)}</td><td>${fmtMoney(cost, r.currency)}</td>`;
    body.appendChild(tr);
  };

  if (r.lines.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "muted";
    tr.innerHTML = `<td colspan="3">Select at least one discipline.</td>`;
    body.appendChild(tr);
    return;
  }

  r.lines.forEach((l) => addRow(l.label, l.hours));
  if (r.coordHours > 0) addRow("Coordination / clash", r.coordHours, "muted");
  addRow("QA &amp; setup", r.qaHours, "muted");
  if (r.contingencyHours > 0) addRow("Contingency", r.contingencyHours, "muted");
  addRow("Total", r.totalHours, "subtotal");

  saveState();
}

/* ---------- persistence ---------- */
const INPUT_IDS = [
  "projectName", "projectType", "area", "areaUnit", "floors", "lod",
  "source", "complexity", "rush", "rate", "currency", "team",
  "hoursPerDay", "contingency",
];

function saveState() {
  const state = {};
  INPUT_IDS.forEach((id) => (state[id] = $(id).value));
  state.disciplines = selectedDisciplines();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function loadState() {
  let state;
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) {}
  if (!state) return;
  INPUT_IDS.forEach((id) => { if (state[id] != null) $(id).value = state[id]; });
  if (Array.isArray(state.disciplines)) {
    document.querySelectorAll("#disciplines input").forEach((cb) => {
      cb.checked = state.disciplines.includes(cb.dataset.id);
      cb.closest(".chip").classList.toggle("active", cb.checked);
    });
  }
  updateContingencyLabel();
}

function updateContingencyLabel() {
  $("contingencyLabel").textContent = $("contingency").value + "%";
}

/* ---------- summary text ---------- */
function summaryText() {
  const r = lastResult || calculate();
  const name = $("projectName").value.trim() || "Untitled project";
  const ft2 = Math.round(r.areaFt2).toLocaleString();
  const lines = r.lines
    .map((l) => `  • ${l.label}: ${fmtHours(l.hours)}`)
    .join("\n");
  return (
`VirtuBuildr — BIM Modeling Estimate
Project: ${name}
Area: ${ft2} ft²  |  Floors: ${$("floors").value}

Disciplines:
${lines}

Total hours: ${fmtHours(r.totalHours)}
Estimated cost: ${fmtMoney(r.cost, r.currency)}  (@ ${fmtMoney(r.rate, r.currency)}/hr)
Duration: ${fmtDuration(r.days)}

Planning estimate — calibrate to historical data.`
  );
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- events ---------- */
function init() {
  buildChips();

  $("estimator").addEventListener("input", (e) => {
    if (e.target.id === "contingency") updateContingencyLabel();
    recalc();
  });

  $("resetBtn").addEventListener("click", () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    location.reload();
  });

  $("copyBtn").addEventListener("click", async () => {
    const text = summaryText();
    try {
      await navigator.clipboard.writeText(text);
      toast("Summary copied");
    } catch (e) {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast("Summary copied"); }
      catch (_) { toast("Copy not supported"); }
      ta.remove();
    }
  });

  $("printBtn").addEventListener("click", () => window.print());

  loadState();
  recalc();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
