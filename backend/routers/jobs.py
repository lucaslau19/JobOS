from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Optional
from dependencies import get_supabase, get_current_user
from services.scraper import scrape_job_url

router = APIRouter()


class JobCreate(BaseModel):
    company: str
    role: str
    jd_text: Optional[str] = None
    url: Optional[str] = None
    salary: Optional[str] = None
    location: Optional[str] = None
    source: str = "external"
    status: str = "saved"
    notes: Optional[str] = None


class JobUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    jd_text: Optional[str] = None
    url: Optional[str] = None
    salary: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    column_order: Optional[int] = None
    notes: Optional[str] = None


class ScrapeRequest(BaseModel):
    url: str


@router.get("/")
async def list_jobs(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("jobs").select("*").eq("user_id", user["id"]).order("column_order").execute()
    return {"jobs": result.data}


@router.post("/")
async def create_job(job: JobCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    data = job.model_dump()
    data["user_id"] = user["id"]
    result = supabase.table("jobs").insert(data).execute()
    return {"job": result.data[0] if result.data else None}


@router.patch("/{job_id}")
async def update_job(
    job_id: str, job: JobUpdate, user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    data = {k: v for k, v in job.model_dump().items() if v is not None}
    result = (
        supabase.table("jobs")
        .update(data)
        .eq("id", job_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job": result.data[0]}


@router.delete("/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("jobs").delete().eq("id", job_id).eq("user_id", user["id"]).execute()
    return {"deleted": True}


@router.post("/scrape")
async def scrape_job(req: ScrapeRequest, user: dict = Depends(get_current_user)):
    """Scrape a job posting URL and return extracted fields as JSON."""
    scraped = await scrape_job_url(req.url)
    if not scraped:
        raise HTTPException(
            status_code=422,
            detail="Could not scrape this URL, please fill in manually",
        )

    return {
        "company": scraped.get("company") or "",
        "role": scraped.get("title") or "",
        "jd_text": scraped.get("description") or "",
        "url": req.url,
        "salary": scraped.get("salary") or "",
        "location": scraped.get("location") or "",
    }
