/* VirtuBuildr — BIM Modeling Estimator
 * Parametric engine + PDF plan viewer + equipment takeoff list.
 * All productivity figures are editable assumptions — calibrate to your data.
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

const CURRENCY = { USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", INR: "₹" };

const STORAGE_KEY = "virtubuildr.estimate.v1";
const EQUIP_KEY = "virtubuildr.equipment.v1";
const $ = (id) => document.getElementById(id);

let lastResult = null;
let equipment = [];
let pdfDoc = null;
let pdfScale = 1;

/* ===================== TABS ===================== */
const TAB_TITLES = {
  estimate: "BIM Modeling Estimator",
  plans: "Plan Viewer",
  equipment: "Equipment Takeoff",
  summary: "Estimate Summary",
};
function switchTab(name) {
  document.querySelectorAll(".tab-panel").forEach((p) =>
    p.classList.toggle("active", p.id === "tab-" + name)
  );
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name)
  );
  $("barSubtitle").textContent = TAB_TITLES[name] || "BIM Modeling Estimator";
  if (name === "plans") updateTiltHint();
  window.scrollTo(0, 0);
}

/* ===================== ACCORDIONS ===================== */
function initAccordions() {
  document.querySelectorAll(".accordion .acc-head").forEach((head) => {
    head.addEventListener("click", () =>
      head.closest(".accordion").classList.toggle("open")
    );
  });
}

/* ===================== DISCIPLINE CHIPS ===================== */
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
  return [...document.querySelectorAll("#disciplines input:checked")].map((cb) => cb.dataset.id);
}

/* ===================== CALCULATION ===================== */
function calculate() {
  const areaRaw = parseFloat($("area").value) || 0;
  const areaToFt2 = parseFloat($("areaUnit").value);
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

  const lines = [];
  let modelingHours = 0;
  DISCIPLINES.forEach((d) => {
    if (!active.includes(d.id)) return;
    const hrs = kSqft * d.rate * factor;
    modelingHours += hrs;
    lines.push({ label: d.label, hours: hrs });
  });

  const coordRate = active.length >= 2 ? 0.08 + 0.03 * active.length : 0;
  const coordHours = modelingHours * Math.min(coordRate, 0.3);
  const qaHours = modelingHours * 0.12;

  const subtotal = modelingHours + coordHours + qaHours;
  const contingencyHours = subtotal * contingency;
  const totalHours = (subtotal + contingencyHours) * rushMult;

  const cost = totalHours * rate;
  const days = totalHours / (team * hoursPerDay);

  return {
    areaFt2, lines, modelingHours, coordHours, qaHours,
    contingencyHours: contingencyHours * rushMult,
    totalHours, cost, days, rate,
    currency: $("currency").value, activeCount: active.length,
  };
}

/* ===================== FORMATTING ===================== */
function fmtMoney(n, cur) { return (CURRENCY[cur] || "$") + Math.round(n).toLocaleString(); }
function fmtHours(n) { return Math.round(n).toLocaleString() + " h"; }
function fmtDuration(days) {
  if (days <= 0) return "—";
  if (days < 1) return "<1 day";
  if (days < 10) return `${Math.ceil(days)} days`;
  return `${(days / 5).toFixed(1)} wks (${Math.ceil(days)}d)`;
}

/* ===================== RENDER ESTIMATE ===================== */
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
    tr.innerHTML = `<td>${label}</td><td>${fmtHours(hours)}</td><td>${fmtMoney(hours * r.rate, r.currency)}</td>`;
    body.appendChild(tr);
  };

  if (r.lines.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "muted";
    tr.innerHTML = `<td colspan="3">Select at least one discipline.</td>`;
    body.appendChild(tr);
  } else {
    r.lines.forEach((l) => addRow(l.label, l.hours));
    if (r.coordHours > 0) addRow("Coordination / clash", r.coordHours, "muted");
    addRow("QA &amp; setup", r.qaHours, "muted");
    if (r.contingencyHours > 0) addRow("Contingency", r.contingencyHours, "muted");
    addRow("Total", r.totalHours, "subtotal");
  }

  renderEquipSummary();
  saveState();
}

/* ===================== EQUIPMENT ===================== */
function renderEquipment() {
  const list = $("equipList");
  list.innerHTML = "";
  const totalQty = equipment.reduce((s, e) => s + (e.qty || 0), 0);
  $("eqCount").textContent = totalQty;
  $("equipEmpty").style.display = equipment.length ? "none" : "block";

  equipment.forEach((e, i) => {
    const li = document.createElement("li");
    li.className = "equip-item";
    li.innerHTML =
      `<div class="eq-main">
         <div class="eq-name"></div>
         <div class="eq-meta"></div>
       </div>
       <span class="eq-qty">×${e.qty}</span>
       <button class="eq-del" aria-label="Remove" data-i="${i}">×</button>`;
    li.querySelector(".eq-name").textContent = e.name;
    li.querySelector(".eq-meta").textContent = e.category;
    li.querySelector(".eq-del").addEventListener("click", () => {
      equipment.splice(i, 1);
      saveEquipment();
      renderEquipment();
      renderEquipSummary();
    });
    list.appendChild(li);
  });
}

function renderEquipSummary() {
  const el = $("equipSummary");
  if (!el) return;
  if (!equipment.length) { el.innerHTML = ""; return; }
  const byCat = {};
  let total = 0;
  equipment.forEach((e) => {
    byCat[e.category] = (byCat[e.category] || 0) + e.qty;
    total += e.qty;
  });
  const rows = Object.entries(byCat)
    .map(([c, q]) => `<tr class="muted"><td>${c}</td><td></td><td>×${q}</td></tr>`)
    .join("");
  el.innerHTML =
    `<h3>Equipment takeoff (${total} items)</h3>
     <table class="breakdown"><tbody>${rows}</tbody></table>`;
}

function saveEquipment() {
  try { localStorage.setItem(EQUIP_KEY, JSON.stringify(equipment)); } catch (e) {}
}
function loadEquipment() {
  try { equipment = JSON.parse(localStorage.getItem(EQUIP_KEY)) || []; } catch (e) { equipment = []; }
}

/* ===================== PDF VIEWER ===================== */
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.js";
}

function fileToArrayBuffer(file) {
  // Blob.arrayBuffer() is missing on some older Android WebViews — fall back.
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(file);
  });
}

async function loadPdf(file) {
  try {
    if (!window.pdfjsLib) { toast("PDF engine not loaded"); return; }
    toast("Opening PDF…");
    const buf = await fileToArrayBuffer(file);
    pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    pdfScale = 1;
    $("pdfEmpty").style.display = "none";
    $("zoomControls").hidden = false;
    await renderAllPages();
    updateTiltHint();
    toast(`Loaded ${pdfDoc.numPages} page${pdfDoc.numPages > 1 ? "s" : ""}`);
  } catch (err) {
    toast("Could not open PDF: " + (err && err.message ? err.message : err));
    console.error(err);
  }
}

async function renderAllPages() {
  if (!pdfDoc) return;
  const container = $("pdfPages");
  container.innerHTML = `<p class="pdf-pagenote">${pdfDoc.numPages} page(s) · pinch to zoom, or tilt to landscape</p>`;

  // clientWidth is 0 when the tab is hidden; fall back to the window width.
  const measured = $("pdfViewport").clientWidth;
  const viewportWidth = (measured > 0 ? measured : window.innerWidth - 32) - 24;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  for (let n = 1; n <= pdfDoc.numPages; n++) {
    const page = await pdfDoc.getPage(n);
    const unscaled = page.getViewport({ scale: 1 });
    const fit = viewportWidth / unscaled.width;
    const viewport = page.getViewport({ scale: fit * pdfScale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    container.appendChild(canvas);

    await page.render({
      canvasContext: ctx,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
    }).promise;
  }
}

function setZoom(delta) {
  pdfScale = Math.min(3, Math.max(0.5, pdfScale + delta));
  $("zoomLabel").textContent = Math.round(pdfScale * 100) + "%";
  renderAllPages();
}

function updateTiltHint() {
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  const onPlans = $("tab-plans").classList.contains("active");
  $("tiltHint").hidden = !(pdfDoc && portrait && onPlans);
}

/* ===================== PERSISTENCE ===================== */
const INPUT_IDS = [
  "projectName", "projectType", "area", "areaUnit", "floors", "lod",
  "source", "complexity", "rush", "rate", "currency", "team", "hoursPerDay", "contingency",
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
function updateContingencyLabel() { $("contingencyLabel").textContent = $("contingency").value + "%"; }

/* ===================== SUMMARY TEXT ===================== */
function summaryText() {
  const r = lastResult || calculate();
  const name = $("projectName").value.trim() || "Untitled project";
  const ft2 = Math.round(r.areaFt2).toLocaleString();
  const lines = r.lines.map((l) => `  • ${l.label}: ${fmtHours(l.hours)}`).join("\n");
  let eq = "";
  if (equipment.length) {
    eq = "\n\nEquipment takeoff:\n" +
      equipment.map((e) => `  • ${e.name} (${e.category}) ×${e.qty}`).join("\n");
  }
  return (
`VirtuBuildr — BIM Modeling Estimate
Project: ${name}
Area: ${ft2} ft²  |  Floors: ${$("floors").value}

Disciplines:
${lines}

Total hours: ${fmtHours(r.totalHours)}
Estimated cost: ${fmtMoney(r.cost, r.currency)}  (@ ${fmtMoney(r.rate, r.currency)}/hr)
Duration: ${fmtDuration(r.days)}${eq}

Planning estimate — calibrate to historical data.`
  );
}

/* ===================== TOAST ===================== */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ===================== INIT ===================== */
function init() {
  buildChips();
  initAccordions();

  // Tabs
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.addEventListener("click", () => switchTab(b.dataset.tab))
  );

  // Estimate inputs
  $("estimator").addEventListener("input", (e) => {
    if (e.target.id === "contingency") updateContingencyLabel();
    recalc();
  });

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("Reset estimate and equipment list?")) return;
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(EQUIP_KEY); } catch (e) {}
    location.reload();
  });

  // Equipment
  $("equipForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("eqName").value.trim();
    if (!name) return;
    equipment.push({
      name,
      category: $("eqCategory").value,
      qty: Math.max(1, parseInt($("eqQty").value, 10) || 1),
    });
    saveEquipment();
    renderEquipment();
    renderEquipSummary();
    $("eqName").value = "";
    $("eqQty").value = "1";
    $("eqName").focus();
    toast("Added");
  });

  // PDF — trigger the (visually hidden) input from a real button; a
  // display:none input wrapped in a label does not open the Android picker.
  $("uploadBtn").addEventListener("click", () => $("pdfInput").click());
  $("pdfInput").addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) loadPdf(e.target.files[0]);
    e.target.value = ""; // allow re-selecting the same file
  });
  $("zoomIn").addEventListener("click", () => setZoom(0.25));
  $("zoomOut").addEventListener("click", () => setZoom(-0.25));

  // Orientation hint
  window.matchMedia("(orientation: portrait)").addEventListener("change", updateTiltHint);
  window.addEventListener("resize", () => { if (pdfDoc) updateTiltHint(); });

  // Summary actions
  $("copyBtn").addEventListener("click", async () => {
    const text = summaryText();
    try {
      await navigator.clipboard.writeText(text);
      toast("Summary copied");
    } catch (e) {
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
  loadEquipment();
  renderEquipment();
  recalc();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
