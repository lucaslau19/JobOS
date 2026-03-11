from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout


async def scrape_job_url(url: str) -> dict | None:
    """
    Scrape a job posting from LinkedIn, Indeed, Greenhouse, Lever, or Workday.
    Returns a dict with title, company, description, salary, location — or None on failure.
    Max 15 seconds per attempt.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(2000)  # Allow JS rendering

            # Detect the site and extract accordingly
            if "linkedin.com" in url:
                return await _scrape_linkedin(page)
            elif "indeed.com" in url:
                return await _scrape_indeed(page)
            elif "greenhouse.io" in url or "boards.greenhouse" in url:
                return await _scrape_greenhouse(page)
            elif "lever.co" in url:
                return await _scrape_lever(page)
            elif "myworkdayjobs.com" in url or "workday.com" in url:
                return await _scrape_workday(page)
            else:
                # Generic fallback: try OpenGraph / meta tags
                return await _scrape_generic(page)
        except PlaywrightTimeout:
            return None
        except Exception:
            return None
        finally:
            await browser.close()


async def _scrape_linkedin(page) -> dict:
    title = await _text(page, "h1.top-card-layout__title, h1.t-24, h1")
    company = await _text(page, "a.topcard__org-name-link, .top-card-layout__card .topcard__flavor, .company-name")
    description = await _text(page, ".show-more-less-html__markup, .description__text, .job-description")
    location = await _text(page, ".topcard__flavor--bullet, .top-card-layout__bullet")
    salary = await _text(page, ".salary-main-rail__current-range, .compensation__salary")

    return {
        "title": title,
        "company": company,
        "description": description,
        "location": location,
        "salary": salary,
    }


async def _scrape_indeed(page) -> dict:
    title = await _text(page, "h1.jobsearch-JobInfoHeader-title, h1[data-testid='jobsearch-JobInfoHeader-title'], h1")
    company = await _text(page, "[data-testid='inlineHeader-companyName'], .jobsearch-InlineCompanyRating-companyHeader a")
    description = await _text(page, "#jobDescriptionText, .jobsearch-jobDescriptionText")
    location = await _text(page, "[data-testid='inlineHeader-companyLocation'], .jobsearch-InlineCompanyRating-companyHeader + div")
    salary = await _text(page, "#salaryInfoAndJobType span, .jobsearch-JobMetadataHeader-item")

    return {
        "title": title,
        "company": company,
        "description": description,
        "location": location,
        "salary": salary,
    }


async def _scrape_greenhouse(page) -> dict:
    title = await _text(page, "h1.app-title, h1")
    company = await _text(page, ".company-name, meta[property='og:site_name']")
    description = await _text(page, "#content, .content")
    location = await _text(page, ".location, .body--metadata")

    return {
        "title": title,
        "company": company,
        "description": description,
        "location": location,
        "salary": None,
    }


async def _scrape_lever(page) -> dict:
    title = await _text(page, "h2.posting-headline, h2")
    company = await _text(page, ".main-header-logo img") or await _attr(page, "meta[property='og:site_name']", "content")
    description = await _text(page, ".section-wrapper.page-full-width, .content")
    location = await _text(page, ".sort-by-time.posting-category .posting-categories .location, .workplaceTypes")

    return {
        "title": title,
        "company": company,
        "description": description[:5000] if description else None,
        "location": location,
        "salary": None,
    }


async def _scrape_workday(page) -> dict:
    title = await _text(page, "h2[data-automation-id='jobPostingHeader'], h1[data-automation-id='jobPostingHeader'], h2, h1")
    company = await _attr(page, "meta[property='og:site_name']", "content") or ""
    description = await _text(page, "div[data-automation-id='jobPostingDescription'], .job-description")
    location = await _text(page, "dd[data-automation-id='locations'] span, span[data-automation-id='location']")
    salary = await _text(page, "div[data-automation-id='compensationPlans'], span[data-automation-id='salary']")

    return {
        "title": title,
        "company": company,
        "description": description[:5000] if description else None,
        "location": location,
        "salary": salary,
    }


async def _scrape_generic(page) -> dict:
    """Fallback scraper using meta tags and page title."""
    title = await _attr(page, "meta[property='og:title']", "content") or await _text(page, "h1")
    company = await _attr(page, "meta[property='og:site_name']", "content") or ""
    description = await _attr(page, "meta[property='og:description']", "content") or await _text(page, "body")

    return {
        "title": title,
        "company": company,
        "description": description[:5000] if description else None,
        "location": None,
        "salary": None,
    }


async def _text(page, selector: str) -> str | None:
    """Safely extract text from the first matching element."""
    try:
        el = page.locator(selector).first
        text = await el.inner_text(timeout=3000)
        return text.strip() if text else None
    except Exception:
        return None


async def _attr(page, selector: str, attribute: str) -> str | None:
    """Safely extract an attribute from the first matching element."""
    try:
        el = page.locator(selector).first
        val = await el.get_attribute(attribute, timeout=3000)
        return val.strip() if val else None
    except Exception:
        return None
