"use client";

import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { KanbanColumn } from "./kanban-column";
import { createClient } from "@/lib/supabase/client";
import {
  WW_COLUMNS,
  EXTERNAL_COLUMNS,
  STATUS_LABELS,
  type Job,
  type JobSource,
  type JobStatus,
} from "@/lib/types";
import { Briefcase } from "lucide-react";

interface KanbanBoardProps {
  jobs: Job[];
  source?: JobSource;
  onJobUpdate: () => void;
  onCardClick?: (job: Job) => void;
}

export function KanbanBoard({ jobs, source, onJobUpdate, onCardClick }: KanbanBoardProps) {
  const supabase = createClient();

  // Determine which columns to show based on source filter
  const columns: JobStatus[] = (() => {
    if (source === "waterlooworks") return WW_COLUMNS;
    if (source === "external") return EXTERNAL_COLUMNS;
    // "all" — merge both column sets, deduplicating
    const all = [...WW_COLUMNS];
    EXTERNAL_COLUMNS.forEach((col) => {
      if (!all.includes(col)) all.splice(all.length - 1, 0, col); // insert before "rejected"
    });
    return all;
  })();

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;

    const jobId = result.draggableId;
    const newStatus = result.destination.droppableId as JobStatus;
    const newOrder = result.destination.index;

    const { error } = await supabase
      .from("jobs")
      .update({ status: newStatus, column_order: newOrder })
      .eq("id", jobId);

    if (!error) {
      onJobUpdate();
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Briefcase className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No jobs yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          Start tracking your job search by clicking &ldquo;Add Job&rdquo; above
          or syncing from WaterlooWorks.
        </p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((status) => {
          const columnJobs = jobs
            .filter((j) => j.status === status)
            .sort((a, b) => a.column_order - b.column_order);

          return (
            <KanbanColumn
              key={status}
              status={status}
              title={STATUS_LABELS[status]}
              jobs={columnJobs}
              count={columnJobs.length}
              onCardClick={onCardClick}
            />
          );
        })}
      </div>
    </DragDropContext>
  );
}
