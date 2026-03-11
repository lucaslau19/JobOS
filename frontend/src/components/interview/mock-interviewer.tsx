"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Mic,
  MicOff,
  Play,
  Volume2,
  ChevronRight,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type {
  MockInterview,
  InterviewScore,
  InterviewQuestion,
} from "@/lib/types";

interface MockInterviewerProps {
  jobId: string;
  jobTitle: string;
  company: string;
  jdText: string | null;
  source: string;
}

const TYPE_COLORS: Record<string, string> = {
  behavioural: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  technical:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "role-specific":
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 10) * circumference;
  const color =
    score >= 8
      ? "text-green-500"
      : score >= 5
        ? "text-yellow-500"
        : "text-red-500";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted/20"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className="absolute text-sm font-bold">{score}/10</span>
    </div>
  );
}

export function MockInterviewer({
  jobId,
  jobTitle,
  company,
  jdText,
  source,
}: MockInterviewerProps) {
  const [sessions, setSessions] = useState<MockInterview[]>([]);
  const [session, setSession] = useState<MockInterview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Completed interview view
  const [showSummary, setShowSummary] = useState(false);

  const supabase = createClient();

  const fetchSessions = useCallback(async () => {
    const authSession = await supabase.auth.getSession();
    const token = authSession.data.session?.access_token;
    try {
      const data = await api.get<{ sessions: MockInterview[] }>(
        `/api/interviews/${jobId}`,
        token
      );
      setSessions(data.sessions || []);
    } catch {
      // ignore
    }
    setLoadingSessions(false);
  }, [jobId, supabase]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function startInterview() {
    setLoading(true);
    try {
      const authSession = await supabase.auth.getSession();
      const token = authSession.data.session?.access_token;

      const data = await api.post<MockInterview>(
        "/api/interviews/generate",
        { job_id: jobId },
        token
      );

      setSession(data);
      setCurrentQ(0);
      setShowSummary(false);
    } catch (err) {
      console.error("Failed to generate questions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function readAloud(text: string) {
    setSpeaking(true);
    try {
      const authSession = await supabase.auth.getSession();
      const token = authSession.data.session?.access_token;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/interviews/speak`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } else {
        setSpeaking(false);
      }
    } catch {
      setSpeaking(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await submitAudio(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function submitAudio(blob: Blob) {
    if (!session) return;
    setSubmitting(true);

    try {
      const authSession = await supabase.auth.getSession();
      const token = authSession.data.session?.access_token;

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("interview_id", session.id);
      formData.append("question_index", String(currentQ));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/interviews/answer`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const data = await response.json();

      // Update local session state
      const updatedAnswers = [...(session.answers || [])];
      const updatedScores = [...(session.scores || [])];
      while (updatedAnswers.length <= currentQ) updatedAnswers.push("");
      while (updatedScores.length <= currentQ) updatedScores.push(null as unknown as InterviewScore);

      updatedAnswers[currentQ] = data.transcript || "";
      updatedScores[currentQ] = data.score;

      setSession({
        ...session,
        answers: updatedAnswers,
        scores: updatedScores,
      });
    } catch (err) {
      console.error("Failed to submit answer:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    if (!session) return;
    if (currentQ < session.questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setShowSummary(true);
    }
  }

  function getAvgScore(s: MockInterview): number {
    const validScores = (s.scores || []).filter((sc) => sc && sc.score);
    if (validScores.length === 0) return 0;
    return Math.round(
      validScores.reduce((sum, sc) => sum + sc.score, 0) / validScores.length
    );
  }

  // ---- Session Summary View ----
  if (session && showSummary) {
    const avgScore = getAvgScore(session);
    const validScores = (session.scores || []).filter((sc) => sc);
    const allImprovements = validScores.flatMap((sc) => sc.improvements || []);
    // Find weakest area
    const weakest =
      allImprovements.length > 0
        ? allImprovements[0]
        : "Keep practicing to identify areas for improvement.";

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Session Complete!</h3>
          <Button variant="outline" size="sm" onClick={startInterview}>
            <RotateCcw className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <ScoreRing score={avgScore} size={80} />
              <div className="space-y-1">
                <p className="text-lg font-semibold">
                  Average Score: {avgScore}/10
                </p>
                <p className="text-sm text-muted-foreground">
                  Across {validScores.length} questions
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Weakest area:</span> {weakest}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-question breakdown */}
        {session.questions.map((q, i) => {
          const qObj = q as InterviewQuestion;
          const score = session.scores?.[i];
          return (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Q{i + 1}</CardTitle>
                  <Badge
                    variant="secondary"
                    className={TYPE_COLORS[qObj.type] || ""}
                  >
                    {qObj.type}
                  </Badge>
                  {score && <ScoreRing score={score.score} size={36} />}
                </div>
                <CardDescription className="text-sm">
                  {qObj.question}
                </CardDescription>
              </CardHeader>
              {score && (
                <CardContent className="text-sm space-y-2">
                  <p>{score.feedback}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {score.strengths?.length > 0 && (
                      <div>
                        <p className="font-medium text-green-700 dark:text-green-400 text-xs mb-1">
                          Strengths
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {score.strengths.map((s, j) => (
                            <li key={j}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {score.improvements?.length > 0 && (
                      <div>
                        <p className="font-medium text-amber-700 dark:text-amber-400 text-xs mb-1">
                          Improvements
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {score.improvements.map((s, j) => (
                            <li key={j}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            setSession(null);
            setShowSummary(false);
            fetchSessions();
          }}
        >
          Back to overview
        </Button>
      </div>
    );
  }

  // ---- Active Interview View ----
  if (session) {
    const currentQuestion = session.questions[currentQ] as InterviewQuestion;
    const currentScore = session.scores?.[currentQ];
    const answered = currentScore && currentScore.score;
    const progress =
      ((currentQ + (answered ? 1 : 0)) / session.questions.length) * 100;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Mock Interview</h3>
          <Badge variant="outline">
            {currentQ + 1} / {session.questions.length}
          </Badge>
        </div>

        <Progress value={progress} />

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">
                Question {currentQ + 1}
              </CardTitle>
              <Badge
                variant="secondary"
                className={TYPE_COLORS[currentQuestion.type] || ""}
              >
                {currentQuestion.type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{currentQuestion.question}</p>
            <p className="text-xs text-muted-foreground italic">
              Tip: {currentQuestion.tips}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => readAloud(currentQuestion.question)}
              disabled={speaking}
            >
              {speaking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Playing...
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" />
                  Read Question Aloud
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Answer area — only show if not yet scored */}
        {!answered && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant={recording ? "destructive" : "outline"}
                size="sm"
                onClick={recording ? stopRecording : startRecording}
                disabled={submitting}
              >
                {recording ? (
                  <>
                    <MicOff className="mr-2 h-4 w-4" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Record Answer
                  </>
                )}
              </Button>
              {recording && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Recording...
                </span>
              )}
            </div>

            {submitting && (
              <div className="flex items-center gap-3 rounded-md border p-3 bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">
                  Transcribing & scoring your answer...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Score display */}
        {answered && currentScore && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-4">
                <ScoreRing score={currentScore.score} />
                <div className="flex-1">
                  <p className="text-sm">{currentScore.feedback}</p>
                </div>
              </div>

              {/* Transcript */}
              {session.answers?.[currentQ] && (
                <div className="rounded-md bg-muted p-3 text-xs">
                  <p className="font-medium mb-1">Your answer:</p>
                  <p>{session.answers[currentQ]}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {currentScore.strengths?.length > 0 && (
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400 text-xs mb-1">
                      Strengths
                    </p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {currentScore.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentScore.improvements?.length > 0 && (
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-400 text-xs mb-1">
                      Improvements
                    </p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {currentScore.improvements.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={nextQuestion}
              >
                {currentQ < session.questions.length - 1 ? (
                  <>
                    Next Question
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  "View Summary"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ---- No Active Session: Start or View Past ----
  return (
    <div className="space-y-4">
      <div className="text-center py-6 space-y-3">
        <h3 className="text-lg font-semibold">AI Mock Interview</h3>
        <p className="text-sm text-muted-foreground">
          Practice for your {company} interview with AI-generated questions
          {source === "waterlooworks" ? " tailored for co-op format" : ""}.
        </p>
        <Button onClick={startInterview} disabled={loading || !jdText}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating questions...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Mock Interview
            </>
          )}
        </Button>
        {!jdText && (
          <p className="text-xs text-muted-foreground">
            Add a job description to enable mock interviews.
          </p>
        )}
      </div>

      {/* Past sessions */}
      {!loadingSessions && sessions.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Past Sessions</h4>
            {sessions.map((s) => {
              const avg = getAvgScore(s);
              const answeredCount = (s.scores || []).filter(
                (sc) => sc && sc.score
              ).length;
              return (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSession(s);
                    setCurrentQ(0);
                    setShowSummary(answeredCount === s.questions.length);
                  }}
                >
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(s.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {answeredCount}/{s.questions.length} questions answered
                      </p>
                    </div>
                    {avg > 0 && <ScoreRing score={avg} size={40} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
