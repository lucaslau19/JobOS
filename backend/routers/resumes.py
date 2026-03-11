from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from dependencies import get_supabase, get_current_user
from services.claude import tailor_resume
import pdfplumber
import io

router = APIRouter()


class TailorRequest(BaseModel):
    job_id: str


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_storage_path(file_url: str) -> str | None:
    """Extract the storage path from a Supabase public URL."""
    marker = "/storage/v1/object/public/resumes/"
    idx = file_url.find(marker)
    if idx >= 0:
        return file_url[idx + len(marker):]
    return None


@router.get("/download/{resume_id}")
async def download_resume(resume_id: str, user: dict = Depends(get_current_user)):
    """Generate a signed download URL for a resume file."""
    supabase = get_supabase()
    result = (
        supabase.table("resume_versions")
        .select("*")
        .eq("id", resume_id)
        .eq("user_id", user["id"])
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Resume not found")

    storage_path = _extract_storage_path(result.data["file_url"])
    if not storage_path:
        raise HTTPException(status_code=404, detail="Resume file not found")

    signed = supabase.storage.from_("resumes").create_signed_url(storage_path, 3600)
    return {"url": signed["signedURL"]}


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a master resume PDF to Supabase Storage."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 5MB")

    supabase = get_supabase()
    user_id = user["id"]
    file_path = f"{user_id}/master.pdf"

    # Upload with upsert so re-uploads overwrite the existing file
    supabase.storage.from_("resumes").upload(
        file_path,
        content,
        {"content-type": "application/pdf", "upsert": "true"},
    )
    url = supabase.storage.from_("resumes").get_public_url(file_path)

    # Get next version number
    existing = (
        supabase.table("resume_versions")
        .select("version_number")
        .eq("user_id", user_id)
        .eq("is_master", True)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    next_version = (existing.data[0]["version_number"] + 1) if existing.data else 1

    result = supabase.table("resume_versions").insert({
        "user_id": user_id,
        "job_id": None,
        "version_number": next_version,
        "file_url": url,
        "is_master": True,
    }).execute()

    return {"resume": result.data[0] if result.data else None}


@router.post("/tailor")
async def tailor_resume_for_job(
    req: TailorRequest, user: dict = Depends(get_current_user)
):
    """Use Claude to tailor the master resume for a specific job."""
    supabase = get_supabase()
    user_id = user["id"]

    # Get the job
    job_result = (
        supabase.table("jobs")
        .select("*")
        .eq("id", req.job_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = job_result.data

    # Get the latest master resume
    master = (
        supabase.table("resume_versions")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_master", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not master.data:
        raise HTTPException(status_code=400, detail="No master resume found. Upload one first.")

    master_resume = master.data[0]

    # Download the PDF directly from storage (private bucket)
    file_url = master_resume["file_url"]
    storage_path = _extract_storage_path(file_url)
    if not storage_path:
        raise HTTPException(status_code=400, detail="Invalid resume file URL")

    try:
        pdf_bytes = supabase.storage.from_("resumes").download(storage_path)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not download master resume PDF")

    resume_text = extract_text_from_pdf(pdf_bytes)
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from resume PDF")

    # Call Claude to tailor
    result = await tailor_resume(
        resume_text=resume_text,
        jd_text=job.get("jd_text", ""),
        company=job.get("company", ""),
        role=job.get("role", ""),
    )

    # Get next version number for this job
    existing = (
        supabase.table("resume_versions")
        .select("version_number")
        .eq("user_id", user_id)
        .eq("job_id", req.job_id)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    next_version = (existing.data[0]["version_number"] + 1) if existing.data else 1

    # Store tailored resume text in Supabase Storage
    tailored_path = f"{user_id}/tailored_{req.job_id}_v{next_version}.txt"
    tailored_content = result.get("rewritten_resume", "")
    try:
        supabase.storage.from_("resumes").upload(
            tailored_path,
            tailored_content.encode("utf-8"),
            {"content-type": "text/plain", "upsert": "true"},
        )
    except Exception:
        pass
    tailored_url = supabase.storage.from_("resumes").get_public_url(tailored_path)

    # Save the tailored version
    saved = supabase.table("resume_versions").insert({
        "user_id": user_id,
        "job_id": req.job_id,
        "version_number": next_version,
        "file_url": tailored_url,
        "match_score": result.get("match_score"),
        "changes_summary": result.get("changes_summary"),
        "is_master": False,
    }).execute()

    return {
        "resume_version": saved.data[0] if saved.data else None,
        "rewritten_resume": result.get("rewritten_resume"),
    }


@router.get("/{job_id}")
async def get_resume_versions(job_id: str, user: dict = Depends(get_current_user)):
    """Get all resume versions for a specific job."""
    supabase = get_supabase()
    result = (
        supabase.table("resume_versions")
        .select("*")
        .eq("user_id", user["id"])
        .or_(f"job_id.eq.{job_id},is_master.eq.true")
        .order("created_at", desc=True)
        .execute()
    )
    return {"versions": result.data}
