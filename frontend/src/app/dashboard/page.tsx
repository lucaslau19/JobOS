"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { JobImportModal } from "@/components/jobs/job-import-modal";
import { JobDrawer } from "@/components/jobs/job-drawer";
import { WWSyncButton } from "@/components/jobs/ww-sync-button";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import type { Job, JobSource } from "@/lib/types";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<JobSource | "all">("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const supabase = createClient();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("column_order", { ascending: true });

    if (!error && data) {
      setJobs(data as Job[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const filteredJobs =
    activeSource === "all"
      ? jobs
      : jobs.filter((j) => j.source === activeSource);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Job Board</h1>
          <p className="text-muted-foreground">
            Track your WaterlooWorks and external applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WWSyncButton onSyncComplete={fetchJobs} variant="outline" size="sm" />
          <Button onClick={() => setImportOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Job
          </Button>
        </div>
      </div>

      <Tabs
        value={activeSource}
        onValueChange={(v) => setActiveSource(v as JobSource | "all")}
      >
        <TabsList>
          <TabsTrigger value="all">All Jobs</TabsTrigger>
          <TabsTrigger value="waterlooworks">WaterlooWorks</TabsTrigger>
          <TabsTrigger value="external">External</TabsTrigger>
        </TabsList>

        <TabsContent value={activeSource} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading jobs...</p>
            </div>
          ) : (
            <KanbanBoard
              jobs={filteredJobs}
              source={activeSource === "all" ? undefined : activeSource}
              onJobUpdate={fetchJobs}
              onCardClick={(job) => {
                setSelectedJob(job);
                setDrawerOpen(true);
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <JobImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onJobAdded={fetchJobs}
      />

      <JobDrawer
        job={selectedJob}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onJobUpdate={fetchJobs}
      />
    </div>
  );
}
