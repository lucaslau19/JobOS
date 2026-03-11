from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from dependencies import get_supabase, get_current_user
from services.claude import generate_interview_questions, score_interview_answer
from services.voice import transcribe_audio, text_to_speech

router = APIRouter()


class GenerateRequest(BaseModel):
    job_id: str


class SpeakRequest(BaseModel):
    text: str


@router.post("/generate")
async def generate_questions(
    req: GenerateRequest, user: dict = Depends(get_current_user)
):
    """Generate mock interview questions for a job using Claude."""
    supabase = get_supabase()

    # Get the job
    job_result = (
        supabase.table("jobs")
        .select("*")
        .eq("id", req.job_id)
        .eq("user_id", user["id"])
        .single()
        .execute()
    )
    if not job_result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = job_result.data

    questions = await generate_interview_questions(
        jd_text=job.get("jd_text", ""),
        company=job.get("company", ""),
        role=job.get("role", ""),
        source=job.get("source", "external"),
    )

    # Save the interview session
    result = supabase.table("mock_interviews").insert({
        "user_id": user["id"],
        "job_id": req.job_id,
        "questions": questions,
        "answers": [],
        "scores": [],
    }).execute()

    return result.data[0] if result.data else None


@router.post("/answer")
async def submit_answer(
    audio: UploadFile = File(...),
    interview_id: str = Form(""),
    question_index: int = Form(0),
    user: dict = Depends(get_current_user),
):
    """Transcribe audio answer and score it using Claude."""
    supabase = get_supabase()

    # Get the interview
    interview_result = (
        supabase.table("mock_interviews")
        .select("*")
        .eq("id", interview_id)
        .eq("user_id", user["id"])
        .single()
        .execute()
    )
    if not interview_result.data:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview = interview_result.data
    if question_index >= len(interview["questions"]):
        raise HTTPException(status_code=400, detail="Invalid question index")

    question_obj = interview["questions"][question_index]
    # Support both old string format and new object format
    question_text = question_obj["question"] if isinstance(question_obj, dict) else str(question_obj)

    # Transcribe audio
    audio_bytes = await audio.read()
    transcript = await transcribe_audio(audio_bytes, audio.filename or "audio.webm")

    # Score with Claude
    score = await score_interview_answer(
        question=question_text,
        answer=transcript,
    )

    # Update the interview with the new answer and score
    answers = interview["answers"] or []
    scores = interview["scores"] or []

    while len(answers) <= question_index:
        answers.append("")
    while len(scores) <= question_index:
        scores.append(None)

    answers[question_index] = transcript
    scores[question_index] = score

    supabase.table("mock_interviews").update({
        "answers": answers,
        "scores": scores,
    }).eq("id", interview_id).execute()

    return {"transcript": transcript, "score": score}


@router.post("/speak")
async def speak(req: SpeakRequest, user: dict = Depends(get_current_user)):
    """Convert text to speech using OpenAI TTS."""
    audio_bytes = await text_to_speech(req.text)
    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.get("/{job_id}")
async def get_interviews(job_id: str, user: dict = Depends(get_current_user)):
    """Get all interview sessions for a job."""
    supabase = get_supabase()
    result = (
        supabase.table("mock_interviews")
        .select("*")
        .eq("user_id", user["id"])
        .eq("job_id", job_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"sessions": result.data}


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Transcribe audio using OpenAI Whisper."""
    content = await audio.read()
    text = await transcribe_audio(content, audio.filename or "audio.webm")
    return {"text": text}
