/* Eventora data layer. The rest of the site only talks to window.EventAPI,
   so it works the same in LIVE mode (Supabase) and DEMO mode (browser storage).
   Methods: listEvents(), register({eventId,name,email,phone,website}), cancel(ref,email). */
(function () {
  const cfg = window.EVENTORA_CONFIG || {};
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const client = LIVE ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const DEMO_KEY = "eventora_demo_regs";

  /* Client-side validation (fast feedback). The database repeats these checks, so they cannot be bypassed. */
  const validators = {
    name(v) {
      v = v.trim();
      if (!v) return "Please enter your name.";
      if (v.length < 3) return "Name must be at least 3 characters.";
      if (!/^[A-Za-z][A-Za-z .'-]*$/.test(v)) return "Use letters only (no digits or symbols).";
      return "";
    },
    email(v) {
      v = v.trim();
      if (!v) return "Please enter your email.";
      if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v)) return "Enter a valid email, e.g. name@example.com.";
      return "";
    },
    phone(v) {
      if (!v.trim()) return "Please enter your phone number.";
      const digits = v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "");
      if (!/^[6-9]\d{9}$/.test(digits)) return "Enter a valid 10-digit mobile number (starts with 6-9).";
      return "";
    },
    event(v) { return v ? "" : "Please select an event."; }
  };

  const demoRegs = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || []; } catch { return []; } };
  const saveDemo = (l) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(l)); } catch { /* blocked */ } };

  async function listEvents() {
    if (LIVE) {
      const { data, error } = await client.from("events_public").select("*").order("starts_at");
      if (error) throw new Error(error.message);
      return data;
    }
    const regs = demoRegs();
    return window.SEED_EVENTS.map((e) => ({ ...e, seats_left: Math.max(e.seats - regs.filter((r) => r.eventId === e.id).length, 0) }));
  }

  async function register({ eventId, name, email, phone, website = "" }) {
    if (LIVE) {
      const { data, error } = await client.rpc("register_for_event", {
        p_event_id: Number(eventId), p_name: name, p_email: email, p_phone: phone, p_website: website
      });
      if (error) return { ok: false, error: "Something went wrong. Please try again." };
      return data;
    }
    // demo mode: same rules as the database function
    if (website) return { ok: true, ref: "EVT-000000" };
    const ev = window.SEED_EVENTS.find((e) => e.id === Number(eventId));
    const list = demoRegs();
    const em = email.trim().toLowerCase();
    if (!ev) return { ok: false, field: "event", error: "This event is not available." };
    if (list.filter((r) => r.eventId === ev.id).length >= ev.seats) return { ok: false, field: "event", error: "Sorry, this event is sold out." };
    if (list.some((r) => r.eventId === ev.id && r.email === em)) return { ok: false, field: "email", error: "This email is already registered for this event." };
    const ref = "EVT-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    list.push({ ref, eventId: ev.id, email: em });
    saveDemo(list);
    return { ok: true, ref };
  }

  async function cancel(ref, email) {
    if (LIVE) {
      const { data, error } = await client.rpc("cancel_registration", { p_ref: ref, p_email: email });
      return !error && !!(data && data.ok);
    }
    const list = demoRegs();
    const next = list.filter((r) => !(r.ref === ref && r.email === email.toLowerCase()));
    saveDemo(next);
    return next.length !== list.length;
  }

  window.EventAPI = { LIVE, client, validators, listEvents, register, cancel };
})();
