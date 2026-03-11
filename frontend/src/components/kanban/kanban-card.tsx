"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Job } from "@/lib/types";
import { MapPin, Calendar, Building2, Sparkles } from "lucide-react";

interface KanbanCardProps {
  job: Job;
  isDragging: boolean;
  onClick?: (job: Job) => void;
}

export function KanbanCard({ job, isDragging, onClick }: KanbanCardProps) {
  return (
    <div onClick={() => onClick?.(job)} role="button" tabIndex={0}>
      <Card
        className={`cursor-pointer transition-shadow hover:shadow-md ${
          isDragging ? "shadow-lg ring-2 ring-primary" : ""
        }`}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{job.role}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{job.company}</span>
              </div>
            </div>
            <Badge
              className={`text-[10px] shrink-0 ${
                job.source === "waterlooworks"
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {job.source === "waterlooworks" ? "WW" : "External"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(job.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {job.salary && (
              <p className="text-xs font-medium text-green-600">{job.salary}</p>
            )}
            {job.match_score != null && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                <Sparkles className="h-3 w-3" />
                {job.match_score}% match
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
