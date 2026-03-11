from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from dependencies import get_supabase, get_current_user
from services.ww_scraper import sync_waterlooworks, WWLoginError

router = APIRouter()


class WWSyncRequest(BaseModel):
    waterloo_id: str
    password: str


@router.post("/sync")
async def sync_ww(req: WWSyncRequest, user: dict = Depends(get_current_user)):
    """
    Sync jobs from WaterlooWorks.

    Credentials are used only for the scraping session and are NEVER persisted.
    They are discarded immediately after the sync completes.
    """
    try:
        jobs = await sync_waterlooworks(req.waterloo_id, req.password)
    except WWLoginError:
        raise HTTPException(
            status_code=401,
            detail="Login failed. Please check your WaterlooWorks credentials.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"WaterlooWorks sync failed: {str(e)}",
        )

    # Upsert scraped jobs into the database
    supabase = get_supabase()
    imported = 0
    updated = 0

    for job in jobs:
        existing = (
            supabase.table("jobs")
            .select("id")
            .eq("user_id", user["id"])
            .eq("ww_job_id", job["ww_job_id"])
            .execute()
        )

        job_data = {
            "company": job.get("company", "Unknown"),
            "role": job.get("title", "Unknown Role"),
            "jd_text": job.get("description"),
            "location": job.get("location"),
            "source": "waterlooworks",
            "ww_job_id": job.get("ww_job_id"),
            "ww_deadline": job.get("deadline"),
            "ww_term": job.get("term"),
            "ww_openings": job.get("openings"),
        }

        if existing.data:
            # Update existing job
            supabase.table("jobs").update(job_data).eq("id", existing.data[0]["id"]).execute()
            updated += 1
        else:
            # Insert new job
            job_data["user_id"] = user["id"]
            job_data["status"] = "saved"
            supabase.table("jobs").insert(job_data).execute()
            imported += 1

    # Credentials are not stored — they go out of scope here
    return {"jobs_imported": imported, "jobs_updated": updated}
