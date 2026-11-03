# Setup guide: going live with Eventora

The site works out of the box in **demo mode** (data stays in the browser). Follow these steps to connect a real database, emails and a domain. Everything below has a free tier. Budget about 45 minutes.

## 1. Create the Supabase project (database + login)

1. Sign up at <https://supabase.com> → **New project** (pick a region near your users, e.g. Mumbai). Save the database password.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, click **Run**.
3. New query again → paste `supabase/seed.sql` → **Run** (adds 10 sample events; delete them later from the admin page).
4. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
5. Open `config.js` and fill in:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ...",
   SITE_URL: "https://your-domain"   // fill after step 5
   ```
   The anon key is meant to be public. Never put the **service_role** key anywhere in the website code.

## 2. Create your organiser (admin) login

1. **Authentication → Users → Add user → Create new user.** Enter your email and a strong password, tick "Auto confirm user".
2. **Authentication → Providers → Email:** turn **off** "Allow new users to sign up" so strangers can't create accounts.
3. In the SQL Editor run (with your email):
   ```sql
   insert into public.admins (email) values ('you@example.com');
   ```
4. Open `admin.html` on your site and log in.

## 3. Confirmation emails (Resend)

1. Sign up at <https://resend.com>, create an **API key**. For testing, emails can only be sent from `onboarding@resend.dev` to your own address. To email everyone, add and verify your domain in Resend and use e.g. `Eventora <events@your-domain>`.
2. Install the Supabase CLI (<https://supabase.com/docs/guides/cli>) and run from the project folder:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase secrets set RESEND_API_KEY=re_xxx FROM_EMAIL="Eventora <events@your-domain>" WEBHOOK_SECRET=<a-long-random-string>
   supabase functions deploy send-confirmation --no-verify-jwt
   ```
3. In the dashboard: **Database → Webhooks → Create a new hook**
   - Table: `registrations`, Events: **Insert**
   - Type: **Supabase Edge Functions** → `send-confirmation`
   - Add an HTTP header: `x-webhook-secret` = the same `WEBHOOK_SECRET` value.
4. Register for a test event with your own email and check your inbox (and spam folder).

## 4. Deploy the site

The site is plain static files, so any static host works.

- **Vercel:** import the GitHub repo → Framework preset **Other** → Deploy. `vercel.json` already adds security headers.
- **Netlify:** import the repo, no build command, publish directory `.` (`_headers` adds the security headers).
- **GitHub Pages:** works too, but it ignores `_headers`/`vercel.json`, so you lose the security headers.

## 5. Custom domain and SEO

1. Buy a domain, add it in your host's **Domains** settings and follow the DNS instructions. HTTPS is automatic.
2. Set `SITE_URL` in `config.js` to the final address.
3. Replace `YOUR-DOMAIN.example` in `robots.txt` and `sitemap.xml`.
4. Replace the placeholder **`og-image.png`** (1200×630) with your own branded image (used for link previews on WhatsApp, LinkedIn, X).
5. Submit `sitemap.xml` in <https://search.google.com/search-console>.

## 6. Before you launch

- [ ] Fill in the bracketed parts of `privacy.html` (your name, contact email, retention period) and have it reviewed.
- [ ] Delete the sample events and add your real ones from `admin.html` (use real image URLs, optional).
- [ ] Make a test registration, a duplicate attempt, a cancellation and check the confirmation email.
- [ ] Log in to `admin.html`, export the CSV, confirm it opens cleanly in Excel/Sheets.
- [ ] Run Lighthouse in Chrome DevTools (Performance, Accessibility, SEO) and fix anything red.
- [ ] Supabase **free projects pause after 7 days of no activity**. Upgrade, or visit the dashboard weekly, for a live site.

## Paid events (optional, later)

The site currently shows prices but does not take payment. To charge, add **Razorpay** (India) or **Stripe Checkout**: create the order in a Supabase Edge Function, confirm the payment via the provider's webhook, and only then create the registration. Never handle card numbers yourself.

## How the security works (so you can maintain it)

- Visitors can only read the `events_public` view, and write through the `register_for_event` and `cancel_registration` functions. They cannot read the `registrations` table.
- Seat limits, duplicate emails and field rules are re-checked inside the database function.
- Only emails listed in `admins` can edit events or read registrations (Row Level Security).
- A hidden "website" field is a honeypot for bots. For heavier spam, add Cloudflare Turnstile.
