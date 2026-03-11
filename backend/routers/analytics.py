from fastapi import APIRouter, Depends
from dependencies import get_supabase, get_current_user
from datetime import datetime, timedelta

router = APIRouter()

PAST_APPLIED = {"interview", "phone_screen", "offer", "ranked", "matched", "rejected"}
INTERVIEW_STATUSES = {"interview", "phone_screen", "offer", "ranked", "matched"}
OFFER_STATUSES = {"offer", "matched"}


def _rate(subset: list, statuses: set) -> int:
    if not subset:
        return 0
    return round(sum(1 for j in subset if j["status"] in statuses) / len(subset) * 100)


def _source_stats(subset: list) -> dict:
    t = len(subset)
    return {
        "total": t,
        "response_rate": _rate(subset, PAST_APPLIED),
        "interview_rate": _rate(subset, INTERVIEW_STATUSES),
        "offer_rate": _rate(subset, OFFER_STATUSES),
    }


@router.get("/summary")
async def get_summary(user: dict = Depends(get_current_user)):
    """Top-level stats: totals, rates, average days to response, split by source."""
    supabase = get_supabase()
    result = supabase.table("jobs").select("*").eq("user_id", user["id"]).execute()
    jobs = result.data or []

    total = len(jobs)
    ww = [j for j in jobs if j["source"] == "waterlooworks"]
    ext = [j for j in jobs if j["source"] == "external"]

    # Average days from created_at to updated_at for jobs past "applied"
    days_sum = 0
    days_count = 0
    for j in jobs:
        if j["status"] in PAST_APPLIED and j.get("updated_at") and j.get("created_at"):
            try:
                created = datetime.fromisoformat(j["created_at"].replace("Z", "+00:00"))
                updated = datetime.fromisoformat(j["updated_at"].replace("Z", "+00:00"))
                days = (updated - created).days
                if days >= 0:
                    days_sum += days
                    days_count += 1
            except Exception:
                pass

    return {
        "total_applications": total,
        "response_rate": _rate(jobs, PAST_APPLIED),
        "interview_rate": _rate(jobs, INTERVIEW_STATUSES),
        "offer_rate": _rate(jobs, OFFER_STATUSES),
        "average_days_to_response": round(days_sum / days_count) if days_count else 0,
        "by_source": {
            "waterlooworks": _source_stats(ww),
            "external": _source_stats(ext),
        },
    }


@router.get("/over-time")
async def get_over_time(user: dict = Depends(get_current_user)):
    """Applications grouped by week for the past 12 weeks, split by source."""
    supabase = get_supabase()
    result = supabase.table("jobs").select("created_at,source").eq("user_id", user["id"]).execute()
    jobs = result.data or []

    now = datetime.utcnow()
    weeks: list[datetime] = []
    for i in range(11, -1, -1):
        d = now - timedelta(weeks=i)
        monday = d - timedelta(days=d.weekday())
        weeks.append(monday.replace(hour=0, minute=0, second=0, microsecond=0))

    data = []
    for idx, week_start in enumerate(weeks):
        week_end = weeks[idx + 1] if idx + 1 < len(weeks) else now + timedelta(days=1)
        ww = 0
        ext = 0
        for j in jobs:
            try:
                created = datetime.fromisoformat(j["created_at"].replace("Z", "+00:00")).replace(tzinfo=None)
                if week_start <= created < week_end:
                    if j["source"] == "waterlooworks":
                        ww += 1
                    else:
                        ext += 1
            except Exception:
                pass
        data.append({
            "week": week_start.strftime("%b %d"),
            "waterlooworks": ww,
            "external": ext,
        })

    return {"weeks": data}


@router.get("/status-breakdown")
async def get_status_breakdown(user: dict = Depends(get_current_user)):
    """Count per status column, split by source."""
    supabase = get_supabase()
    result = supabase.table("jobs").select("status,source").eq("user_id", user["id"]).execute()
    jobs = result.data or []

    ww_counts: dict[str, int] = {}
    ext_counts: dict[str, int] = {}

    for j in jobs:
        status = j["status"]
        if j["source"] == "waterlooworks":
            ww_counts[status] = ww_counts.get(status, 0) + 1
        else:
            ext_counts[status] = ext_counts.get(status, 0) + 1

    return {
        "waterlooworks": [{"status": k, "count": v} for k, v in ww_counts.items()],
        "external": [{"status": k, "count": v} for k, v in ext_counts.items()],
    }


@router.get("/resume-performance")
async def get_resume_performance(user: dict = Depends(get_current_user)):
    """Each resume version with application count and response rate."""
    supabase = get_supabase()
    user_id = user["id"]

    masters = (
        supabase.table("resume_versions")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_master", True)
        .order("created_at")
        .execute()
    ).data or []

    tailored = (
        supabase.table("resume_versions")
        .select("id,job_id,created_at")
        .eq("user_id", user_id)
        .eq("is_master", False)
        .order("created_at")
        .execute()
    ).data or []

    jobs_result = (
        supabase.table("jobs")
        .select("id,status")
        .eq("user_id", user_id)
        .execute()
    )
    jobs_map = {j["id"]: j for j in (jobs_result.data or [])}

    performance = []
    for i, m in enumerate(masters):
        m_created = m["created_at"]
        next_created = masters[i + 1]["created_at"] if i + 1 < len(masters) else "9999-12-31T23:59:59"

        related = [t for t in tailored if m_created <= t["created_at"] < next_created]
        app_count = len(related)
        responded = sum(
            1 for t in related
            if jobs_map.get(t.get("job_id", ""), {}).get("status") in PAST_APPLIED
        )

        performance.append({
            "id": m["id"],
            "version_number": m["version_number"],
            "created_at": m["created_at"],
            "application_count": app_count,
            "response_rate": round(responded / app_count * 100) if app_count else 0,
        })

    return {"resumes": performance}
