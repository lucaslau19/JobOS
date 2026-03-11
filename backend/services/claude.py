import json
from anthropic import AsyncAnthropic
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL

client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)


async def tailor_resume(
    resume_text: str,
    jd_text: str,
    company: str,
    role: str,
) -> dict:
    """Use Claude to tailor a resume for a specific job description."""
    prompt = f"""You are an expert technical resume writer. Given the job description and the candidate's resume, rewrite the resume to be highly tailored to this role. Return a JSON object with three fields: rewritten_resume (full resume as plain text), match_score (0-100 integer), changes_summary (array of strings describing what changed and why).

Company: {company}
Role: {role}

Job Description:
{jd_text}

Candidate's Resume:
{resume_text}

Respond ONLY with valid JSON in this exact format:
{{
  "rewritten_resume": "...",
  "match_score": <number 0-100>,
  "changes_summary": ["change 1", "change 2", ...]
}}"""

    message = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    # Parse the response
    text = message.content[0].text
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(text[start:end])
            # Ensure changes_summary is a list
            if isinstance(parsed.get("changes_summary"), str):
                parsed["changes_summary"] = [parsed["changes_summary"]]
            return parsed
    except json.JSONDecodeError:
        pass

    return {
        "rewritten_resume": text,
        "match_score": 50,
        "changes_summary": ["Could not parse structured response from Claude"],
    }


async def generate_interview_questions(
    jd_text: str,
    company: str,
    role: str,
    source: str,
) -> list[dict]:
    """Generate mock interview questions based on a job description."""
    coop_context = ""
    if source == "waterlooworks":
        coop_context = "This is a University of Waterloo co-op position. Keep questions appropriate for students."

    prompt = f"""You are a technical interviewer. Based on this job description, generate 6 interview questions: 2 behavioural, 2 technical, and 2 role-specific. {coop_context}

Company: {company}
Role: {role}

Job Description:
{jd_text}

Return a JSON array of objects with fields: question (string), type (behavioural | technical | role-specific), tips (string with 1-2 sentence hint for the candidate).
Return ONLY the JSON array, no other text."""

    message = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text
    try:
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            parsed = json.loads(text[start:end])
            if parsed and isinstance(parsed[0], dict):
                return parsed
    except json.JSONDecodeError:
        pass

    # Fallback questions
    return [
        {"question": f"Tell me about yourself and why you're interested in {company}.", "type": "behavioural", "tips": "Use the STAR method to structure your response."},
        {"question": "Describe a challenging project you've worked on.", "type": "behavioural", "tips": "Focus on your specific contributions and what you learned."},
        {"question": f"What technical skills make you a good fit for this {role} position?", "type": "technical", "tips": "Connect your skills directly to requirements in the JD."},
        {"question": "Walk me through how you would debug a production issue.", "type": "technical", "tips": "Show your systematic approach to problem-solving."},
        {"question": f"What interests you most about the {role} role at {company}?", "type": "role-specific", "tips": "Show you've researched the company and understand the role."},
        {"question": "Where do you see yourself growing in this field?", "type": "role-specific", "tips": "Demonstrate ambition while showing interest in the company's domain."},
    ]


async def score_interview_answer(
    question: str,
    answer: str,
) -> dict:
    """Score an interview answer using Claude."""
    prompt = f"""You are an experienced technical interviewer. Score the following interview answer.

Question: {question}

Candidate's Answer: {answer}

Provide a score from 1-10, constructive feedback (2-3 sentences), an array of strengths, and an array of areas for improvement.

Respond in this exact JSON format:
{{
  "score": <1-10>,
  "feedback": "<2-3 sentence constructive feedback>",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"]
}}"""

    message = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except json.JSONDecodeError:
        pass

    return {
        "score": 5,
        "feedback": "Unable to generate detailed feedback. Please try again.",
        "strengths": [],
        "improvements": [],
    }
