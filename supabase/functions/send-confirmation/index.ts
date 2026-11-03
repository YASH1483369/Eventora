// Supabase Edge Function: sends a confirmation email when a registration is created.
// Triggered by a Database Webhook on INSERT into public.registrations (see SETUP.md).
// Secrets needed: RESEND_API_KEY, FROM_EMAIL (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically).
// Deploy: supabase functions deploy send-confirmation --no-verify-jwt   (protected by WEBHOOK_SECRET below)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  // Only accept calls that carry our shared secret (set the same value in the webhook header).
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const reg = payload.record;
  if (payload.type !== "INSERT" || !reg) return new Response("Ignored", { status: 200 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ev } = await supabase.from("events").select("title, starts_at, venue, city").eq("id", reg.event_id).single();
  if (!ev) return new Response("Event not found", { status: 404 });

  const when = new Date(ev.starts_at).toLocaleString("en-IN", {
    dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata",
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
      <h2 style="color:#6c4cf1">You're registered! 🎉</h2>
      <p>Hi ${esc(reg.name)}, your spot is confirmed.</p>
      <p><strong>${esc(ev.title)}</strong><br>${esc(when)}<br>${esc(ev.venue)}, ${esc(ev.city)}</p>
      <p style="background:#f1efff;padding:12px 16px;border-radius:8px">Booking ID: <strong>${esc(reg.ref)}</strong></p>
      <p style="color:#666;font-size:13px">Need to cancel? Use your booking ID and this email on the website's My Tickets section.</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("FROM_EMAIL") ?? "Eventora <onboarding@resend.dev>",
      to: [reg.email],
      subject: `Confirmed: ${ev.title}`,
      html,
    }),
  });

  return new Response(res.ok ? "Sent" : await res.text(), { status: res.ok ? 200 : 502 });
});
