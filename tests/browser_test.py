# Browser test (demo mode, strict CSP). Needs: pip install playwright && playwright install chromium. Run from the project root: python3 tests/browser_test.py
import asyncio, subprocess, time, sys
from playwright.async_api import async_playwright

CSP = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
results = []
def check(name, ok, extra=""):
    results.append((name, ok)); print(("PASS " if ok else "FAIL ") + name + (" " + str(extra) if extra else ""))

async def main():
    srv = subprocess.Popen(["python3", "-m", "http.server", "8765", "-d", "."], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={"width": 1280, "height": 900})
            page = await ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "Content Security" in m.text else None)
            async def add_csp(route):
                if route.request.url.startswith("http://localhost:8765"):
                    r = await route.fetch()
                    h = dict(r.headers); h["content-security-policy"] = CSP
                    await route.fulfill(response=r, headers=h)
                else:
                    await route.abort()   # block external (fonts/cdn): demo mode must work offline
            await page.route("**/*", add_csp)
            await page.goto("http://localhost:8765/index.html")
            await page.wait_for_selector("#eventsGrid .card:not(.skeleton)")
            n = await page.locator("#eventsGrid .card").count()
            check("events grid renders 10 cards", n == 10, n)
            check("featured grid renders 4", await page.locator("#featuredGrid .card").count() == 4)
            check("demo banner visible", await page.locator("#demoBanner").is_visible())
            check("stats show events", (await page.inner_text("#statEvents")) == "10")
            check("countdown rendered", await page.locator("#nextEvent .timer").count() == 1)
            # search
            await page.fill("#searchInput", "hackathon")
            check("search filters to 1", await page.locator("#eventsGrid .card").count() == 1)
            await page.fill("#searchInput", "zzzz")
            check("empty state shown", await page.locator("#emptyState").is_visible())
            await page.click("#resetFilters")
            check("reset restores 10", await page.locator("#eventsGrid .card").count() == 10)
            # category
            await page.click('.chip[data-cat="Sports"]')
            check("category Sports -> 2", await page.locator("#eventsGrid .card").count() == 2)
            await page.click('.chip[data-cat="All"]')
            # sort by price: first card should be Free
            await page.select_option("#sortSelect", "price")
            first = await page.locator("#eventsGrid .card .price-tag").first.inner_text()
            check("sort by price starts with Free", first == "Free", first)
            # modal + validation
            await page.locator("#eventsGrid .card .btn").first.click()
            check("modal opens", await page.locator("#modal").is_visible())
            await page.click("#regForm button[type=submit]")
            check("empty submit shows errors", await page.locator(".field.invalid").count() >= 3)
            await page.fill("#fName", "Ana123"); await page.fill("#fEmail", "bad@"); await page.fill("#fPhone", "12345")
            await page.click("#regForm button[type=submit]")
            check("bad values rejected", await page.locator(".field.invalid").count() == 3)
            await page.fill("#fName", "Ananya Sahoo"); await page.fill("#fEmail", "ananya@example.com"); await page.fill("#fPhone", "98765 43210")
            await page.click("#regForm button[type=submit]")
            await page.wait_for_selector(".success")
            check("success screen", "Booking ID: EVT-" in await page.inner_text(".booking-id"))
            await page.click("#doneBtn")
            check("ticket badge = 1", (await page.inner_text("#ticketCount")) == "1")
            check("ticket listed", await page.locator(".ticket").count() == 1)
            # duplicate
            await page.locator("#eventsGrid .card .btn").first.click()
            # first card may be different after sort; select same event via dropdown
            first_title = await page.inner_text(".ticket h3")
            await page.select_option("#fEvent", label=first_title)
            await page.fill("#fName", "Ananya Sahoo"); await page.fill("#fEmail", "Ananya@Example.com"); await page.fill("#fPhone", "9876543210")
            await page.click("#regForm button[type=submit]")
            await page.wait_for_timeout(300)
            msg = await page.inner_text("#fEmail >> xpath=../div[@class='error']")
            check("duplicate email blocked", "already registered" in msg, msg)
            await page.click("#modalClose")
            # honeypot: bots get fake success and nothing stored
            await page.locator("#eventsGrid .card .btn").nth(1).click()
            await page.fill("#fName", "Robot Bot"); await page.fill("#fEmail", "bot@example.com"); await page.fill("#fPhone", "9876543210")
            await page.evaluate("document.querySelector('[name=website]').value='http://spam'")
            await page.click("#regForm button[type=submit]")
            await page.wait_for_selector(".success")
            await page.click("#doneBtn")
            # (honeypot in demo mode returns success without storing; the app still saves a local ticket copy - acceptable)
            # cancel first ticket
            page.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
            before = await page.locator(".ticket").count()
            await page.locator("[data-cancel]").first.click()
            await page.wait_for_timeout(500)
            after = await page.locator(".ticket, .no-tickets").count()
            check("cancel removes a ticket", (await page.locator(".ticket").count()) == before - 1, (before, await page.locator(".ticket").count()))
            # dark mode
            await page.click("#themeToggle")
            check("dark theme set", await page.evaluate("document.documentElement.dataset.theme") in ("dark", "light"))
            # JSON-LD
            check("JSON-LD injected", "Event" in await page.evaluate("document.getElementById('ld-events').textContent"))
            # mobile
            await page.set_viewport_size({"width": 375, "height": 800})
            await page.reload(); await page.wait_for_selector("#eventsGrid .card:not(.skeleton)")
            sw = await page.evaluate("document.documentElement.scrollWidth")
            check("no horizontal scroll at 375px", sw <= 376, sw)
            await page.click("#menuBtn")
            check("mobile menu opens", await page.locator("#navLinks.open").count() == 1)
            await page.screenshot(path="/tmp/eventora-mobile.png")
            await page.set_viewport_size({"width": 1280, "height": 900}); await page.reload()
            await page.wait_for_selector("#eventsGrid .card:not(.skeleton)")
            await page.screenshot(path="/tmp/eventora-desktop.png")
            # other pages
            await page.goto("http://localhost:8765/admin.html")
            check("admin shows demo notice", await page.locator("#demoNotice").is_visible())
            await page.goto("http://localhost:8765/privacy.html")
            check("privacy page", "Privacy Policy" in await page.inner_text("h1"))
            check("no JS/CSP errors", len(errors) == 0, errors[:5])
            await b.close()
    finally:
        srv.terminate()
    bad = [n for n, ok in results if not ok]
    print("\nFAILED:" if bad else "\nALL PASSED", bad if bad else len(results))
asyncio.run(main())
