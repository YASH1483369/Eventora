/* Eventora - app.js (public site)
   1 Constants · 2 Helpers · 3 State · 4 Rendering · 5 Filters · 6 Modal & form
   7 My Tickets · 8 Countdown · 9 Theme/Nav/Reveal · 10 SEO data · 11 Init */

/* 1. CONSTANTS ------------------------------------------------------- */
const CAT_EMOJI = { Tech: "💻", Music: "🎵", Workshop: "🛠️", Sports: "⚽", Cultural: "🎭", Business: "💼" };
const CAT_GRADIENT = {
  Tech: "linear-gradient(135deg,#4f46e5,#06b6d4)", Music: "linear-gradient(135deg,#db2777,#f59e0b)",
  Workshop: "linear-gradient(135deg,#0d9488,#84cc16)", Sports: "linear-gradient(135deg,#16a34a,#0ea5e9)",
  Cultural: "linear-gradient(135deg,#ea580c,#be185d)", Business: "linear-gradient(135deg,#334155,#6c4cf1)"
};
const TICKETS_KEY = "eventora_tickets";
const THEME_KEY = "eventora_theme";

/* 2. HELPERS --------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const fmtPrice = (p) => (p === 0 ? "Free" : "₹" + p);
// only allow http(s) image URLs coming from the database
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3000);
}

function imageHTML(ev, big) {
  const url = safeUrl(ev.image_url);
  const fallback = `<div class="img-fallback" style="background:${CAT_GRADIENT[ev.category] || "var(--grad)"}"><span>${CAT_EMOJI[ev.category] || "🎟️"}</span></div>`;
  if (!url) return fallback;
  return `<img src="${esc(url)}" alt="${esc(ev.title)}" ${big ? "" : 'loading="lazy"'} data-fb="${esc(fallback)}" />`;
}
// broken image -> swap in the gradient fallback (error events don't bubble, so listen in capture phase)
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img && img.tagName === "IMG" && img.dataset.fb) img.outerHTML = img.dataset.fb;
}, true);

/* 3. STATE ----------------------------------------------------------- */
let EVENTS = [];
let activeCategory = "All";
let searchTerm = "";
let sortBy = "date";

function getTickets() { try { return JSON.parse(localStorage.getItem(TICKETS_KEY)) || []; } catch { return []; } }
function saveTickets(l) { try { localStorage.setItem(TICKETS_KEY, JSON.stringify(l)); } catch { /* blocked */ } }
const upcoming = () => EVENTS.filter((e) => new Date(e.starts_at) > new Date());

/* 4. RENDERING ------------------------------------------------------- */
function cardHTML(ev, i) {
  const left = ev.seats_left;
  return `
    <article class="card" style="animation-delay:${Math.min(i, 8) * 60}ms">
      <div class="card-img">
        ${imageHTML(ev)}
        <span class="badge">${CAT_EMOJI[ev.category] || ""} ${esc(ev.category)}</span>
        <span class="price-tag">${fmtPrice(ev.price)}</span>
      </div>
      <div class="card-body">
        <div class="meta"><span>📅 ${fmtDate(ev.starts_at)} · ${fmtTime(ev.starts_at)}</span><span>📍 ${esc(ev.venue)}, ${esc(ev.city)}</span></div>
        <h3>${esc(ev.title)}</h3>
        <p class="desc">${esc(ev.short_desc)}</p>
        <div class="card-foot">
          <span class="seats ${left <= 20 ? "low" : ""}">${left > 0 ? left + " seats left" : "Sold out"}</span>
          <button class="btn btn-primary" data-id="${ev.id}">${left > 0 ? "View & Register" : "View details"}</button>
        </div>
      </div>
    </article>`;
}

const skeletons = (n) => Array.from({ length: n }, () => `<div class="card skeleton"><div class="card-img"></div><div class="card-body"><i></i><i></i><i></i></div></div>`).join("");

function renderFeatured() {
  const list = upcoming().filter((e) => e.featured);
  $("#featuredGrid").innerHTML = list.length ? list.map(cardHTML).join("") : `<p class="muted">No featured events right now.</p>`;
}

function renderEvents() {
  const term = searchTerm.trim().toLowerCase();
  const list = upcoming().filter((e) => {
    const okCat = activeCategory === "All" || e.category === activeCategory;
    const hay = `${e.title} ${e.venue} ${e.city} ${e.category} ${e.short_desc}`.toLowerCase();
    return okCat && hay.includes(term);
  });
  list.sort((a, b) =>
    sortBy === "name" ? a.title.localeCompare(b.title)
    : sortBy === "price" ? a.price - b.price
    : new Date(a.starts_at) - new Date(b.starts_at));
  $("#eventsGrid").innerHTML = list.map(cardHTML).join("");
  $("#emptyState").hidden = list.length > 0;
  $("#resultCount").textContent = `${list.length} event${list.length === 1 ? "" : "s"} found`;
}

function renderChips() {
  const cats = ["All", ...new Set(EVENTS.map((e) => e.category))];
  $("#chips").innerHTML = cats.map((c) =>
    `<button class="chip ${c === activeCategory ? "active" : ""}" data-cat="${esc(c)}" aria-pressed="${c === activeCategory}">${c === "All" ? "✨" : CAT_EMOJI[c] || ""} ${esc(c)}</button>`).join("");
}

function renderStats() {
  $("#statEvents").textContent = upcoming().length;
  $("#statCats").textContent = new Set(EVENTS.map((e) => e.category)).size;
  $("#statReg").textContent = getTickets().length;
  $("#ticketCount").textContent = getTickets().length;
}

function renderAll() {
  renderChips();
  renderFeatured();
  renderEvents();
  renderTickets();
  renderStats();
  updateCountdown();
  injectStructuredData();
}

async function loadEvents() {
  $("#featuredGrid").innerHTML = skeletons(3);
  $("#eventsGrid").innerHTML = skeletons(6);
  try {
    EVENTS = await EventAPI.listEvents();
    renderAll();
  } catch (err) {
    const msg = `<div class="load-error"><p>😕 We couldn't load events. Please check your connection.</p><button class="btn btn-primary" id="retryBtn">Try again</button></div>`;
    $("#featuredGrid").innerHTML = "";
    $("#eventsGrid").innerHTML = msg;
    $("#retryBtn").addEventListener("click", loadEvents);
  }
}

/* 5. FILTERS --------------------------------------------------------- */
function initFilters() {
  $("#searchInput").addEventListener("input", (e) => { searchTerm = e.target.value; renderEvents(); });
  $("#sortSelect").addEventListener("change", (e) => { sortBy = e.target.value; renderEvents(); });
  $("#chips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    renderChips();
    renderEvents();
  });
  $("#resetFilters").addEventListener("click", () => {
    activeCategory = "All"; searchTerm = ""; $("#searchInput").value = "";
    renderChips(); renderEvents();
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".card .btn[data-id]");
    if (btn) openModal(btn.dataset.id);
  });
}

/* 6. MODAL & FORM ---------------------------------------------------- */
function openModal(id) {
  const ev = EVENTS.find((e) => String(e.id) === String(id));
  if (!ev) return;
  const left = ev.seats_left;
  $("#modalBody").innerHTML = `
    <div class="detail">
      <div class="detail-info">
        <div class="detail-img">${imageHTML(ev, true)}</div>
        <div class="detail-text">
          <span class="badge badge-inline">${CAT_EMOJI[ev.category] || ""} ${esc(ev.category)}</span>
          <h2 id="modalTitle">${esc(ev.title)}</h2>
          <ul class="info-list">
            <li>📅 <strong>${fmtDate(ev.starts_at)}</strong> at ${fmtTime(ev.starts_at)}</li>
            <li>📍 ${esc(ev.venue)}, ${esc(ev.city)}</li>
            <li>💰 ${fmtPrice(ev.price)} per person</li>
            <li>🪑 ${left > 0 ? left + " of " + ev.seats + " seats left" : "Sold out"}</li>
          </ul>
          <p>${esc(ev.long_desc)}</p>
        </div>
      </div>
      <form class="detail-form" id="regForm" novalidate>
        <h3>Register now</h3>
        <p class="sub">Fill in your details to reserve a spot.</p>
        <div class="field"><label for="fName">Full name</label>
          <input id="fName" name="name" type="text" autocomplete="name" placeholder="e.g. Ananya Sahoo" maxlength="80" />
          <div class="error"></div></div>
        <div class="field"><label for="fEmail">Email address</label>
          <input id="fEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" maxlength="254" />
          <div class="error"></div></div>
        <div class="field"><label for="fPhone">Phone number</label>
          <input id="fPhone" name="phone" type="tel" autocomplete="tel" placeholder="10-digit mobile number" maxlength="14" />
          <div class="error"></div></div>
        <div class="field"><label for="fEvent">Selected event</label>
          <select id="fEvent" name="event">${upcoming().map((e) => `<option value="${e.id}" ${e.id === ev.id ? "selected" : ""}>${esc(e.title)}</option>`).join("")}</select>
          <div class="error"></div></div>
        <div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
        <p class="consent">By registering you agree to our <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>
        <button class="btn btn-primary btn-block" type="submit" ${left <= 0 ? "disabled" : ""}>${left > 0 ? "Confirm registration" : "Sold out"}</button>
        <div class="form-error" id="formError" role="alert"></div>
      </form>
    </div>`;
  $("#modal").hidden = false;
  document.body.style.overflow = "hidden";
  setupForm();
  $("#modalClose").focus();
}

function closeModal() {
  $("#modal").hidden = true;
  document.body.style.overflow = "";
}

function setFieldState(input, message) {
  const field = input.closest(".field");
  field.classList.toggle("invalid", !!message);
  field.classList.toggle("valid", !message && input.value.trim() !== "");
  field.querySelector(".error").textContent = message;
}

function setupForm() {
  const form = $("#regForm");
  const inputs = $$("input[name], select", form).filter((i) => i.name !== "website");
  const rules = EventAPI.validators;
  inputs.forEach((inp) => {
    inp.addEventListener("blur", () => setFieldState(inp, rules[inp.name](inp.value)));
    inp.addEventListener("input", () => {
      if (inp.closest(".field").classList.contains("invalid")) setFieldState(inp, rules[inp.name](inp.value));
    });
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let firstBad = null;
    inputs.forEach((inp) => {
      const msg = rules[inp.name](inp.value);
      setFieldState(inp, msg);
      if (msg && !firstBad) firstBad = inp;
    });
    if (firstBad) { firstBad.focus(); return; }

    const btn = $("button[type=submit]", form);
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Registering…";
    $("#formError").textContent = "";
    const fd = new FormData(form);
    const res = await EventAPI.register({
      eventId: fd.get("event"), name: fd.get("name"), email: fd.get("email"),
      phone: fd.get("phone"), website: fd.get("website")
    });
    btn.disabled = false; btn.textContent = label;

    if (!res.ok) {
      const input = res.field && $(`[name=${res.field}]`, form);
      if (input) { setFieldState(input, res.error); input.focus(); }
      else $("#formError").textContent = res.error || "Something went wrong.";
      return;
    }
    const ev = EVENTS.find((x) => String(x.id) === String(fd.get("event")));
    if (res.ref === "EVT-000000") { showSuccess({ ref: res.ref, name: fd.get("name").trim(), email: fd.get("email").trim() }, ev); return; } // honeypot hit: look successful, store nothing
    const ticket = {
      ref: res.ref, eventId: ev.id, eventTitle: ev.title, startsAt: ev.starts_at, venue: `${ev.venue}, ${ev.city}`,
      name: fd.get("name").trim(), email: fd.get("email").trim().toLowerCase()
    };
    saveTickets([...getTickets(), ticket]);
    showSuccess(ticket, ev);
    loadEventsQuiet();
  });
}

function showSuccess(t, ev) {
  const emailNote = EventAPI.LIVE
    ? `A confirmation email is on its way to <strong>${esc(t.email)}</strong>.`
    : `Demo mode: no email is sent. Your ticket is saved in this browser.`;
  $("#modalBody").innerHTML = `
    <div class="success">
      <div class="tick">✓</div>
      <h2 id="modalTitle">You're in, ${esc(t.name.split(" ")[0])}! 🎉</h2>
      <p>Your registration for <strong>${esc(ev.title)}</strong> is confirmed.</p>
      <p>📅 ${fmtDate(ev.starts_at)} at ${fmtTime(ev.starts_at)} · 📍 ${esc(ev.venue)}</p>
      <p>${emailNote}</p>
      <div class="booking-id">Booking ID: ${esc(t.ref)}</div><br />
      <button class="btn btn-primary" id="doneBtn">Done</button>
    </div>`;
  $("#doneBtn").addEventListener("click", closeModal);
}

function initModal() {
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
}

/* refresh seat counts without flashing skeletons */
async function loadEventsQuiet() {
  try { EVENTS = await EventAPI.listEvents(); renderAll(); } catch { /* keep old data */ }
}

/* 7. MY TICKETS ------------------------------------------------------ */
function renderTickets() {
  const list = getTickets();
  const box = $("#ticketList");
  if (!list.length) {
    box.innerHTML = `<div class="no-tickets">No registrations yet. Pick an event above and grab your first ticket! 🎟️</div>`;
    return;
  }
  box.innerHTML = list.map((t) => `
    <div class="ticket">
      <small>${esc(t.ref)}</small>
      <h3>${esc(t.eventTitle)}</h3>
      <small>📅 ${fmtDate(t.startsAt)} · ${fmtTime(t.startsAt)}</small>
      <small>📍 ${esc(t.venue)}</small>
      <small>👤 ${esc(t.name)} · ${esc(t.email)}</small>
      <button class="btn btn-danger" data-cancel="${esc(t.ref)}">Cancel registration</button>
    </div>`).join("");
}

function initTickets() {
  $("#ticketList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cancel]");
    if (!btn) return;
    const t = getTickets().find((x) => x.ref === btn.dataset.cancel);
    if (!t || !confirm("Cancel this registration?")) return;
    btn.disabled = true;
    const ok = await EventAPI.cancel(t.ref, t.email);
    btn.disabled = false;
    if (!ok) { toast("Couldn't cancel. Please try again."); return; }
    saveTickets(getTickets().filter((x) => x.ref !== t.ref));
    toast("Registration cancelled.");
    loadEventsQuiet();
  });
}

/* 8. COUNTDOWN ------------------------------------------------------- */
function updateCountdown() {
  const box = $("#nextEvent");
  const next = upcoming().sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
  if (!next) {
    box.innerHTML = EVENTS.length ? "<h3>No upcoming events right now - check back soon!</h3>" : "";
    return;
  }
  const diff = Math.max(0, new Date(next.starts_at) - new Date());
  const pad = (n) => String(n).padStart(2, "0");
  box.innerHTML = `
    <div class="label">⏳ Next up</div>
    <h3>${esc(next.title)}</h3>
    <div class="timer">
      <div><strong>${pad(Math.floor(diff / 864e5))}</strong><span>Days</span></div>
      <div><strong>${pad(Math.floor(diff / 36e5) % 24)}</strong><span>Hours</span></div>
      <div><strong>${pad(Math.floor(diff / 6e4) % 60)}</strong><span>Mins</span></div>
      <div><strong>${pad(Math.floor(diff / 1e3) % 60)}</strong><span>Secs</span></div>
    </div>`;
}

/* 9. THEME / NAV / REVEAL -------------------------------------------- */
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  applyTheme(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  });
}
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $("#themeToggle").textContent = t === "dark" ? "☀️" : "🌙";
}

function initNav() {
  const menu = $("#navLinks"), btn = $("#menuBtn");
  btn.addEventListener("click", () => btn.setAttribute("aria-expanded", menu.classList.toggle("open")));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => { menu.classList.remove("open"); btn.setAttribute("aria-expanded", false); }));
  addEventListener("scroll", () => $("#navbar").classList.toggle("scrolled", scrollY > 10), { passive: true });
  const links = $$("a", menu);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id)); });
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.map((a) => $(a.getAttribute("href"))).forEach((s) => s && spy.observe(s));
}

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  $$(".reveal").forEach((el) => io.observe(el));
}

/* 10. SEO: schema.org Event data so Google can show rich results ----- */
function injectStructuredData() {
  const base = (window.EVENTORA_CONFIG && EVENTORA_CONFIG.SITE_URL) || location.origin;
  const data = upcoming().map((e) => ({
    "@type": "Event", name: e.title, description: e.short_desc, startDate: e.starts_at,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: e.venue, address: { "@type": "PostalAddress", addressLocality: e.city, addressCountry: "IN" } },
    offers: { "@type": "Offer", price: e.price, priceCurrency: "INR", url: base + "/#events", availability: e.seats_left > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut" }
  }));
  let tag = $("#ld-events");
  if (!tag) { tag = document.createElement("script"); tag.type = "application/ld+json"; tag.id = "ld-events"; document.head.appendChild(tag); }
  tag.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": data });
}

/* 11. INIT ----------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNav();
  initFilters();
  initModal();
  initTickets();
  initReveal();
  renderTickets();
  renderStats();
  $("#year").textContent = new Date().getFullYear();
  const site = window.EVENTORA_CONFIG && EVENTORA_CONFIG.SITE_URL;
  if (site) $("#canonical").href = site.replace(/\/$/, "") + "/";
  if (!EventAPI.LIVE) $("#demoBanner").hidden = false;
  loadEvents();
  setInterval(updateCountdown, 1000);
});
