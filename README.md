# 🎟️ Eventora - Event Management Website

Responsive event website where visitors browse, search and filter upcoming events, view details, and register. Includes an organiser dashboard, server-side validation, confirmation emails, and SEO basics. Built with **HTML5, CSS3 and vanilla JavaScript** on top of **Supabase** (no build step).

- **Live site:** https://eventora-drab-three.vercel.app/
- **GitHub repo:** https://github.com/YASH1483369/Eventora.git


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
```


## Notes

- Payments are not implemented (prices are display-only).
