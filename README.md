# 🎟️ Eventora - Event Management Website

Responsive event website where visitors browse, search and filter upcoming events, view details, and register. Includes an organiser dashboard, server-side validation, confirmation emails, and SEO basics. Built with **HTML5, CSS3 and vanilla JavaScript** on top of **Supabase** (no build step).

- **Live site:** _add your deployed link here_
- **GitHub repo:** _add your repository link here_

## Two modes

| Mode | When | Data stored |
|---|---|---|
| **Demo** | `config.js` has empty Supabase values (default) | Browser only. Good for trying it out and for the college demo. |
| **Live** | Supabase URL + anon key set in `config.js` | Real PostgreSQL database, admin login, emails. |

See **[SETUP.md](SETUP.md)** to go live.

## Features

- Hero with live countdown to the next event, animated, dark/light mode (remembered)
- Featured + upcoming event cards (image or category gradient, date, venue, price, seats left)
- Live search, category chips, sorting; loading skeletons and error retry
- Event detail modal with registration form: JS validation, duplicate and sold-out checks, confirmation screen with booking ID
- "My Tickets" (this device) with cancel
- **Live mode extras:** server-side validation and seat locking, honeypot spam trap, confirmation email, organiser dashboard (`admin.html`: add/edit/delete events, view registrations, CSV export), schema.org Event data for Google, privacy policy, 404 page, security headers, robots/sitemap

## Project structure

```
index.html / styles.css / app.js     public site
api.js                               data layer: Supabase (live) or browser (demo); shared validation
config.js                            Supabase URL + anon key + site URL
data/seed-events.js                  sample events for demo mode
admin.html / admin.css / admin.js    organiser dashboard
privacy.html / 404.html / legal.css  legal + error pages
robots.txt / sitemap.xml             SEO
vercel.json / _headers               security headers (Vercel / Netlify)
supabase/schema.sql                  tables, security rules, register/cancel functions
supabase/seed.sql                    sample events for the live database
supabase/functions/send-confirmation Edge Function that emails the booking confirmation
og-image.png                         social link preview (placeholder)
tests/                               browser_test.py (Playwright) and db-test.sql (PostgreSQL)
SETUP.md / HANDOFF.md                go-live steps / status for the next developer or agent
```

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

(Opening `index.html` directly also works in demo mode.)

## Deploy

Static hosting: Vercel, Netlify or GitHub Pages. Details in [SETUP.md](SETUP.md).

## Push to GitHub

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## Notes

- The Supabase **anon key is public by design**; security comes from Row Level Security in `schema.sql`. Never commit the `service_role` key or email API keys.
- Payments are not implemented (prices are display-only). See "Paid events" in SETUP.md.
