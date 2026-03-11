"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ResumeManager } from "@/components/resume/resume-manager";
import { MockInterviewer } from "@/components/interview/mock-interviewer";
import {
  ArrowLeft,
  Building2,
  MapPin,
  ExternalLink,
  Calendar,
  Save,
} from "lucide-react";
import type { Job, STATUS_LABELS } from "@/lib/types";

const STATUS_LABELS_MAP: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  rejected: "Rejected",
  ranked: "Ranked",
  matched: "Matched",
  phone_screen: "Phone Screen",
  offer: "Offer",
};

export function JobDetailClient({ job: initialJob }: { job: Job }) {
  const [job, setJob] = useState(initialJob);
  const [notes, setNotes] = useState(job.notes || "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function saveNotes() {
    setSaving(true);
    await supabase.from("jobs").update({ notes }).eq("id", job.id);
    setJob({ ...job, notes });
    setSaving(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{job.role}</h1>
            <Badge
              variant={
                job.source === "waterlooworks" ? "default" : "secondary"
              }
            >
              {job.source === "waterlooworks" ? "WaterlooWorks" : "External"}
            </Badge>
            <Badge variant="outline">
              {STATUS_LABELS_MAP[job.status] || job.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {job.company}
            </span>
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
            )}
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Job Posting
              </a>
            )}
          </div>
        </div>
      </div>

      {/* WaterlooWorks metadata */}
      {job.source === "waterlooworks" && (
        <div className="flex gap-4 text-sm">
          {job.ww_term && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {job.ww_term}
            </span>
          )}
          {job.ww_deadline && (
            <span>
              Deadline: {new Date(job.ww_deadline).toLocaleDateString()}
            </span>
          )}
          {job.ww_openings && <span>{job.ww_openings} opening(s)</span>}
          {job.ww_job_id && (
            <span className="text-muted-foreground">ID: {job.ww_job_id}</span>
          )}
        </div>
      )}

      {job.salary && (
        <p className="text-lg font-medium text-green-600">{job.salary}</p>
      )}

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="description">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="interview">Mock Interview</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="description" className="mt-4">
          {job.jd_text ? (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {job.jd_text}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No job description available.
            </p>
          )}
        </TabsContent>

        <TabsContent value="resume" className="mt-4">
          <ResumeManager jobId={job.id} jdText={job.jd_text} />
        </TabsContent>

        <TabsContent value="interview" className="mt-4">
          <MockInterviewer
            jobId={job.id}
            jobTitle={job.role}
            company={job.company}
            jdText={job.jd_text}
            source={job.source}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this application..."
            rows={8}
          />
          <Button onClick={saveNotes} disabled={saving} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Notes"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
