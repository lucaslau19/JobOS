from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import FRONTEND_URL
from routers import jobs, waterlooworks, resumes, interviews, analytics

app = FastAPI(
    title="JobOS API",
    description="Backend API for the JobOS job search tracking platform",
    version="1.0.0",
)

# CORS — allow frontend origin (localhost variants for dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(waterlooworks.router, prefix="/api/waterlooworks", tags=["WaterlooWorks"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["Resumes"])
app.include_router(interviews.router, prefix="/api/interviews", tags=["Interviews"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
