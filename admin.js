/* Eventora - admin.js
   Login (Supabase Auth) -> check admins table -> manage events and view registrations.
   Security note: the real protection is Row Level Security in the database; hiding
   buttons here is only for convenience. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (iso) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const show = (id, on) => { $(id).hidden = !on; };
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2800); }

  // theme (shared with the public site)
  const root = document.documentElement;
  try { root.dataset.theme = localStorage.getItem("eventora_theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch { root.dataset.theme = "light"; }
  const tbtn = $("#themeToggle");
  tbtn.textContent = root.dataset.theme === "dark" ? "☀️" : "🌙";
  tbtn.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    tbtn.textContent = root.dataset.theme === "dark" ? "☀️" : "🌙";
    try { localStorage.setItem("eventora_theme", root.dataset.theme); } catch { /* ignore */ }
  });

  document.addEventListener("DOMContentLoaded", init);

  let sb, events = [], regs = [];

  async function init() {
    if (!EventAPI.LIVE) { show("#demoNotice", true); return; }
    sb = EventAPI.client;
    const { data } = await sb.auth.getSession();
    data.session ? await enter() : show("#loginPanel", true);

    $("#loginForm").addEventListener("submit", login);
    $("#logoutBtn").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
    $("#newEventBtn").addEventListener("click", () => openForm());
    $("#evClose").addEventListener("click", closeForm);
    $("#evModal").addEventListener("click", (e) => { if (e.target.id === "evModal") closeForm(); });
    $("#evForm").addEventListener("submit", saveEvent);
    $("#regFilter").addEventListener("change", renderRegs);
    $("#csvBtn").addEventListener("click", exportCsv);
    $("#eventsTable").addEventListener("click", onEventAction);
    $("#regsTable").addEventListener("click", onRegAction);
  }

  async function login(e) {
    e.preventDefault();
    $("#loginError").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: $("#lEmail").value.trim(), password: $("#lPass").value });
    if (error) { $("#loginError").textContent = "Login failed. Check your email and password."; return; }
    show("#loginPanel", false);
    await enter();
  }

  async function enter() {
    // an admin can read the admins table; anyone else gets an empty list
    const { data: admins } = await sb.from("admins").select("email");
    $("#logoutBtn").hidden = false;
    if (!admins || !admins.length) { show("#deniedPanel", true); return; }
    show("#dash", true);
    await loadAll();
  }

  async function loadAll() {
    const [e, r] = await Promise.all([
      sb.from("events").select("*").order("starts_at", { ascending: false }),
      sb.from("registrations").select("*").order("created_at", { ascending: false })
    ]);
    if (e.error || r.error) { toast("Couldn't load data."); return; }
    events = e.data; regs = r.data;
    renderStats(); renderEvents(); renderFilter(); renderRegs();
  }

  const countFor = (id) => regs.filter((r) => r.event_id === id).length;

  function renderStats() {
    $("#sEvents").textContent = events.length;
    $("#sRegs").textContent = regs.length;
    const total = events.reduce((a, x) => a + x.seats, 0);
    $("#sSeats").textContent = total ? Math.round((regs.length / total) * 100) + "%" : "0%";
  }

  function renderEvents() {
    $("#eventsTable tbody").innerHTML = events.map((ev) => `
      <tr>
        <td><strong>${esc(ev.title)}</strong>${ev.featured ? " ⭐" : ""}</td>
        <td>${fmt(ev.starts_at)}</td>
        <td>${esc(ev.category)}</td>
        <td>${countFor(ev.id)} / ${ev.seats}</td>
        <td><span class="pill ${ev.published ? "" : "off"}">${ev.published ? "Published" : "Hidden"}</span></td>
        <td><div class="row-actions">
          <button class="link-btn" data-edit="${ev.id}">Edit</button>
          <button class="link-btn del" data-del="${ev.id}">Delete</button></div></td>
      </tr>`).join("") || `<tr><td colspan="6" class="muted">No events yet. Click "New event".</td></tr>`;
  }

  function renderFilter() {
    const cur = $("#regFilter").value;
    $("#regFilter").innerHTML = `<option value="">All events</option>` + events.map((e) => `<option value="${e.id}">${esc(e.title)}</option>`).join("");
    $("#regFilter").value = cur;
  }

  const filteredRegs = () => { const f = $("#regFilter").value; return f ? regs.filter((r) => String(r.event_id) === f) : regs; };

  function renderRegs() {
    const title = (id) => (events.find((e) => e.id === id) || {}).title || "-";
    $("#regsTable tbody").innerHTML = filteredRegs().map((r) => `
      <tr>
        <td>${esc(r.ref)}</td><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.phone)}</td>
        <td>${esc(title(r.event_id))}</td><td>${fmt(r.created_at)}</td>
        <td><button class="link-btn del" data-rdel="${r.id}">Remove</button></td>
      </tr>`).join("") || `<tr><td colspan="7" class="muted">No registrations yet.</td></tr>`;
  }

  /* ---- events CRUD ---- */
  const toLocalInput = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  function openForm(ev) {
    const f = $("#evForm");
    f.reset();
    $("#evError").textContent = "";
    $("#evModalTitle").textContent = ev ? "Edit event" : "New event";
    f.id.value = ev ? ev.id : "";
    if (ev) {
      ["title", "category", "venue", "city", "price", "seats", "image_url", "short_desc", "long_desc"].forEach((k) => { f[k].value = ev[k] ?? ""; });
      f.starts_at.value = toLocalInput(ev.starts_at);
      f.featured.checked = ev.featured; f.published.checked = ev.published;
    }
    show("#evModal", true);
  }
  function closeForm() { show("#evModal", false); }

  async function saveEvent(e) {
    e.preventDefault();
    const f = e.target;
    const url = f.image_url.value.trim();
    if (url && !/^https:\/\//i.test(url)) { $("#evError").textContent = "Image URL must start with https://"; return; }
    for (const k of ["title", "venue", "city", "short_desc", "long_desc", "starts_at"]) {
      if (!f[k].value.trim()) { $("#evError").textContent = "Please fill in all required fields."; return; }
    }
    const row = {
      title: f.title.value.trim(), category: f.category.value,
      starts_at: new Date(f.starts_at.value).toISOString(),
      venue: f.venue.value.trim(), city: f.city.value.trim(),
      price: Math.max(0, parseInt(f.price.value || "0", 10)), seats: Math.max(1, parseInt(f.seats.value || "1", 10)),
      image_url: url || null, short_desc: f.short_desc.value.trim(), long_desc: f.long_desc.value.trim(),
      featured: f.featured.checked, published: f.published.checked
    };
    const q = f.id.value ? sb.from("events").update(row).eq("id", f.id.value) : sb.from("events").insert(row);
    const { error } = await q;
    if (error) { $("#evError").textContent = "Couldn't save: " + error.message; return; }
    closeForm(); toast("Event saved."); loadAll();
  }

  async function onEventAction(e) {
    const edit = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (edit) openForm(events.find((x) => String(x.id) === edit.dataset.edit));
    if (del) {
      const ev = events.find((x) => String(x.id) === del.dataset.del);
      if (!confirm(`Delete "${ev.title}" and all its ${countFor(ev.id)} registrations? This cannot be undone.`)) return;
      const { error } = await sb.from("events").delete().eq("id", ev.id);
      error ? toast("Couldn't delete.") : (toast("Event deleted."), loadAll());
    }
  }

  async function onRegAction(e) {
    const del = e.target.closest("[data-rdel]");
    if (!del || !confirm("Remove this registration?")) return;
    const { error } = await sb.from("registrations").delete().eq("id", del.dataset.rdel);
    error ? toast("Couldn't remove.") : (toast("Registration removed."), loadAll());
  }

  /* ---- CSV export (guards against spreadsheet formula injection) ---- */
  function exportCsv() {
    const title = (id) => (events.find((e) => e.id === id) || {}).title || "";
    const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = [["Booking ID", "Name", "Email", "Phone", "Event", "Registered at"]]
      .concat(filteredRegs().map((r) => [r.ref, r.name, r.email, r.phone, title(r.event_id), r.created_at]));
    const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eventora-registrations.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
})();
