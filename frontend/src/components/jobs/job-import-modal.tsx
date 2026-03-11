"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Link as LinkIcon } from "lucide-react";
import type { JobSource } from "@/lib/types";

interface JobImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobAdded: () => void;
}

export function JobImportModal({
  open,
  onOpenChange,
  onJobAdded,
}: JobImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [source, setSource] = useState<JobSource>("external");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [url, setUrl] = useState("");
  const [jdText, setJdText] = useState("");
  const supabase = createClient();

  function resetForm() {
    setScrapeUrl("");
    setCompany("");
    setRole("");
    setLocation("");
    setSalary("");
    setUrl("");
    setJdText("");
    setSource("external");
    setError(null);
  }

  async function handleScrape() {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setError(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const data = await api.post<{
        company: string;
        role: string;
        jd_text: string;
        url: string;
        salary: string;
        location: string;
      }>("/api/jobs/scrape", { url: scrapeUrl }, token);

      // Auto-fill form fields
      setCompany(data.company || "");
      setRole(data.role || "");
      setJdText(data.jd_text || "");
      setUrl(data.url || scrapeUrl);
      setSalary(data.salary || "");
      setLocation(data.location || "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not scrape this URL, please fill in manually"
      );
    } finally {
      setScraping(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;

    const { error: insertError } = await supabase.from("jobs").insert({
      user_id: userId,
      company,
      role,
      jd_text: jdText || null,
      url: url || null,
      salary: salary || null,
      location: location || null,
      source,
      status: "saved",
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      onJobAdded();
      onOpenChange(false);
      resetForm();
    }
    setLoading(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Job</DialogTitle>
          <DialogDescription>
            Paste a job URL to auto-import or enter details manually.
          </DialogDescription>
        </DialogHeader>

        {/* URL Import Section */}
        <div className="space-y-2 rounded-md border p-3 bg-muted/30">
          <Label className="text-xs font-medium text-muted-foreground">
            <LinkIcon className="inline h-3 w-3 mr-1" />
            Quick Import
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://linkedin.com/jobs/..."
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              disabled={scraping}
            />
            <Button
              onClick={handleScrape}
              disabled={scraping || !scrapeUrl.trim()}
              size="sm"
              className="shrink-0"
            >
              {scraping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import from URL"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Supports LinkedIn, Indeed, Greenhouse, Lever, and Workday.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Job Form — always visible, auto-filled by scrape */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary">Salary</Label>
              <Input
                id="salary"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              value={source}
              onValueChange={(v) => setSource(v as JobSource)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="waterlooworks">WaterlooWorks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jd_text">Job Description</Label>
            <Textarea
              id="jd_text"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={4}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Job"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
