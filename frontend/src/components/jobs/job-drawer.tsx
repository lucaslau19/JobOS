"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ResumeManager } from "@/components/resume/resume-manager";
import { MockInterviewer } from "@/components/interview/mock-interviewer";
import type { Job } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import {
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  DollarSign,
  Trash2,
} from "lucide-react";

interface JobDrawerProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobUpdate: () => void;
}

export function JobDrawer({
  job,
  open,
  onOpenChange,
  onJobUpdate,
}: JobDrawerProps) {
  const [notes, setNotes] = useState(job?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  // Sync notes when a different job is selected
  if (job && notes !== (job.notes ?? "") && !saving) {
    setNotes(job.notes ?? "");
  }

  async function handleSaveNotes() {
    if (!job) return;
    setSaving(true);
    await supabase.from("jobs").update({ notes }).eq("id", job.id);
    setSaving(false);
    onJobUpdate();
  }

  async function handleDelete() {
    if (!job) return;
    setDeleting(true);
    await supabase.from("jobs").delete().eq("id", job.id);
    setDeleting(false);
    onOpenChange(false);
    onJobUpdate();
  }

  if (!job) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-2 pr-6">
            <div className="min-w-0">
              <SheetTitle className="text-lg">{job.role}</SheetTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Building2 className="h-4 w-4 shrink-0" />
                <span>{job.company}</span>
              </div>
            </div>
            <Badge
              className={`shrink-0 ${
                job.source === "waterlooworks"
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {job.source === "waterlooworks" ? "WW" : "External"}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="outline">{STATUS_LABELS[job.status]}</Badge>
            </div>
            {job.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{job.location}</span>
              </div>
            )}
            {job.salary && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4 shrink-0" />
                <span>{job.salary}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Added {new Date(job.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View original posting
            </a>
          )}

          <Separator />

          {/* Tabs for Description / Resume / Notes */}
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="resume">Resume</TabsTrigger>
              <TabsTrigger value="interview">Interview</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-4">
              {/* WW-specific fields */}
              {job.source === "waterlooworks" && (
                <div className="space-y-2 text-sm">
                  <h4 className="font-medium">WaterlooWorks Details</h4>
                  {job.ww_term && (
                    <p className="text-muted-foreground">Term: {job.ww_term}</p>
                  )}
                  {job.ww_openings && (
                    <p className="text-muted-foreground">
                      Openings: {job.ww_openings}
                    </p>
                  )}
                  {job.ww_deadline && (
                    <p className="text-muted-foreground">
                      Deadline:{" "}
                      {new Date(job.ww_deadline).toLocaleDateString()}
                    </p>
                  )}
                  <Separator />
                </div>
              )}

              {/* Job Description */}
              {job.jd_text ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Job Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                    {job.jd_text}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
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
                placeholder="Add your notes about this job..."
                rows={6}
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={saving || notes === (job.notes ?? "")}
              >
                {saving ? "Saving..." : "Save Notes"}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Delete */}
          <Separator />
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete Job"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
