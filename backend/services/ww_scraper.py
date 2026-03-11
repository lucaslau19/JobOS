from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout


class WWLoginError(Exception):
    """Raised when WaterlooWorks login fails."""
    pass


async def sync_waterlooworks(waterloo_id: str, password: str) -> list[dict]:
    """
    Log into WaterlooWorks and scrape active co-op job postings.

    SECURITY: Credentials are only used within this function scope and are
    never stored or logged. They are discarded when this function returns.

    Returns a list of job dicts with keys:
    ww_job_id, title, company, description, location, deadline, term, openings
    """
    jobs: list[dict] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context()
            page = await context.new_page()

            # Navigate to WaterlooWorks login
            await page.goto(
                "https://waterlooworks.uwaterloo.ca/waterloo.htm",
                wait_until="domcontentloaded",
                timeout=30000,
            )

            # Fill login form
            await page.fill('input[name="username"], #username', waterloo_id)
            await page.fill('input[name="password"], #password', password)
            await page.click('button[type="submit"], input[type="submit"]')

            # Wait for navigation after login
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except PlaywrightTimeout:
                raise WWLoginError("Login timed out — WaterlooWorks may be down.")

            # Check if login succeeded
            if "login" in page.url.lower() or "error" in page.url.lower():
                raise WWLoginError(
                    "Login failed. Please check your WaterlooWorks credentials."
                )

            # Navigate to the job postings / co-op postings page
            await page.goto(
                "https://waterlooworks.uwaterloo.ca/myAccount/co-op/full/jobs.htm",
                wait_until="domcontentloaded",
                timeout=15000,
            )

            # Extract job listings from the table
            rows = page.locator("table.table tbody tr, .posting-list .posting-row")
            count = await rows.count()

            for i in range(count):
                row = rows.nth(i)
                try:
                    job = {
                        "ww_job_id": await _cell_text(row, 0),
                        "title": await _cell_text(row, 1),
                        "company": await _cell_text(row, 2),
                        "location": await _cell_text(row, 3),
                        "openings": _parse_int(await _cell_text(row, 4)),
                        "deadline": await _cell_text(row, 5),
                        "term": await _cell_text(row, 6),
                        "description": None,
                    }

                    # Try to click into the job to get the full JD
                    try:
                        link = row.locator("td a, td").first
                        await link.click(timeout=3000)
                        await page.wait_for_load_state("domcontentloaded", timeout=5000)
                        jd_el = page.locator(".posting-description, .job-description, #postingDiv")
                        jd_text = await jd_el.inner_text(timeout=3000)
                        job["description"] = jd_text.strip()[:5000] if jd_text else None
                        await page.go_back(wait_until="domcontentloaded", timeout=5000)
                    except Exception:
                        pass  # JD extraction is best-effort

                    if job["title"]:
                        jobs.append(job)
                except Exception:
                    continue

        finally:
            # Ensure credential-bearing session is destroyed
            await browser.close()

    return jobs


async def _cell_text(row, index: int) -> str | None:
    """Extract text from a table cell by index."""
    try:
        cell = row.locator("td").nth(index)
        text = await cell.inner_text(timeout=2000)
        return text.strip() if text else None
    except Exception:
        return None


def _parse_int(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None
