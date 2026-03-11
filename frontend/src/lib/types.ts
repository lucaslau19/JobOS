// Shared TypeScript types for JobOS

export type JobSource = "waterlooworks" | "external";

export type JobStatus =
  | "saved"
  | "applied"
  | "interview"
  | "rejected"
  | "ranked"
  | "matched"
  | "phone_screen"
  | "offer";

export interface Job {
  id: string;
  user_id: string;
  company: string;
  role: string;
  jd_text: string | null;
  url: string | null;
  salary: string | null;
  location: string | null;
  status: JobStatus;
  source: JobSource;
  column_order: number;
  ww_job_id: string | null;
  ww_deadline: string | null;
  ww_term: string | null;
  ww_openings: number | null;
  notes: string | null;
  match_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeVersion {
  id: string;
  user_id: string;
  job_id: string | null;
  version_number: number;
  file_url: string;
  match_score: number | null;
  changes_summary: string | null;
  is_master: boolean;
  created_at: string;
}

export interface InterviewQuestion {
  question: string;
  type: "behavioural" | "technical" | "role-specific";
  tips: string;
}

export interface MockInterview {
  id: string;
  user_id: string;
  job_id: string;
  questions: InterviewQuestion[];
  answers: string[];
  scores: InterviewScore[];
  feedback: string | null;
  created_at: string;
}

export interface InterviewScore {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

// Column definitions per source type
export const WW_COLUMNS: JobStatus[] = [
  "saved",
  "applied",
  "interview",
  "ranked",
  "matched",
  "rejected",
];

export const EXTERNAL_COLUMNS: JobStatus[] = [
  "saved",
  "applied",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
];

export const STATUS_LABELS: Record<JobStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  rejected: "Rejected",
  ranked: "Ranked",
  matched: "Matched",
  phone_screen: "Phone Screen",
  offer: "Offer",
};
