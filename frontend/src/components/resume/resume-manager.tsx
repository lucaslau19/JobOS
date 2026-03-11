"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Upload, FileText, Sparkles, Download, Loader2 } from "lucide-react";
import type { ResumeVersion } from "@/lib/types";

interface ResumeManagerProps {
  jobId: string;
  jdText: string | null;
}

export function ResumeManager({ jobId, jdText }: ResumeManagerProps) {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tailoring, setTailoring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchVersions();
  }, [jobId]);

  async function fetchVersions() {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    try {
      const data = await api.get<{ versions: ResumeVersion[] }>(
        `/api/resumes/${jobId}`,
        token
      );
      setVersions(data.versions || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleDownload(resumeId: string) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    try {
      const data = await api.get<{ url: string }>(
        `/api/resumes/download/${resumeId}`,
        token
      );
      window.open(data.url, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const formData = new FormData();
    formData.append("file", file);

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/resumes/upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      await fetchVersions();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleTailor() {
    if (!jdText) return;
    setTailoring(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      await api.post(
        "/api/resumes/tailor",
        { job_id: jobId },
        token
      );

      await fetchVersions();
    } catch (err) {
      console.error("Tailoring failed:", err);
    } finally {
      setTailoring(false);
    }
  }

  function matchScoreBadge(score: number | null) {
    if (score === null) return null;
    let variant: "default" | "secondary" | "destructive" = "destructive";
    let className = "bg-red-600 hover:bg-red-700 text-white";
    if (score >= 75) {
      variant = "default";
      className = "bg-green-600 hover:bg-green-700 text-white";
    } else if (score >= 50) {
      variant = "secondary";
      className = "bg-yellow-500 hover:bg-yellow-600 text-white";
    }
    return (
      <Badge className={className}>
        {score}% Match
      </Badge>
    );
  }

  const masterResume = versions.find((v) => v.is_master);
  const tailoredVersions = versions.filter((v) => !v.is_master && v.job_id === jobId);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading resumes...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Resume</h3>
        <div className="flex gap-2">
          <label className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
            <Upload className="mr-1 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload PDF"}
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          {masterResume && jdText && (
            <Button size="sm" onClick={handleTailor} disabled={tailoring}>
              {tailoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Tailoring...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Tailor Resume for this Job
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Tailoring loading state */}
      {tailoring && (
        <div className="flex items-center gap-3 rounded-md border p-4 bg-muted/30">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">Claude is tailoring your resume...</p>
            <p className="text-xs text-muted-foreground">
              Analyzing the job description and optimizing your resume.
            </p>
          </div>
        </div>
      )}

      {/* Master Resume */}
      {masterResume && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Master Resume</CardTitle>
              <Badge variant="outline">Master</Badge>
            </div>
            <CardDescription>
              Uploaded {new Date(masterResume.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => handleDownload(masterResume.id)}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </CardContent>
        </Card>
      )}

      {/* Tailored Versions */}
      {tailoredVersions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Tailored Versions
          </h4>
          {tailoredVersions.map((version) => (
            <Card key={version.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Version {version.version_number}
                  </CardTitle>
                  {matchScoreBadge(version.match_score)}
                </div>
                <CardDescription>
                  {new Date(version.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <button
                  onClick={() => handleDownload(version.id)}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Download className="h-4 w-4" />
                  Download Tailored Resume
                </button>
                {version.changes_summary && (
                  <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                    <p className="font-medium mb-2">Changes Made:</p>
                    {Array.isArray(version.changes_summary) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {(version.changes_summary as unknown as string[]).map(
                          (change, i) => (
                            <li key={i}>{change}</li>
                          )
                        )}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {version.changes_summary}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!masterResume && (
        <div className="text-center py-8 space-y-2">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Upload a master resume (PDF, max 5MB) to get started with AI
            tailoring.
          </p>
        </div>
      )}
    </div>
  );
}
