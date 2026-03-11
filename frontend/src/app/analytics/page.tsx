"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { STATUS_LABELS } from "@/lib/types";

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

interface SummaryData {
  total_applications: number;
  response_rate: number;
  interview_rate: number;
  offer_rate: number;
  average_days_to_response: number;
  by_source: {
    waterlooworks: { total: number; response_rate: number; interview_rate: number; offer_rate: number };
    external: { total: number; response_rate: number; interview_rate: number; offer_rate: number };
  };
}

interface WeekData {
  week: string;
  waterlooworks: number;
  external: number;
}

interface StatusItem {
  status: string;
  count: number;
}

interface ResumePerf {
  id: string;
  version_number: number;
  created_at: string;
  application_count: number;
  response_rate: number;
}

function StatCard({
  title,
  value,
  suffix,
  wwValue,
  extValue,
  loading,
}: {
  title: string;
  value: number;
  suffix?: string;
  wwValue?: string;
  extValue?: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">
          {value}
          {suffix && <span className="text-lg">{suffix}</span>}
        </p>
        {(wwValue || extValue) && (
          <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
            {wwValue && <span className="text-purple-600">WW: {wwValue}</span>}
            {extValue && <span className="text-blue-600">Ext: {extValue}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [wwStatus, setWwStatus] = useState<StatusItem[]>([]);
  const [extStatus, setExtStatus] = useState<StatusItem[]>([]);
  const [resumes, setResumes] = useState<ResumePerf[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    try {
      const [summaryRes, timeRes, statusRes, resumeRes] = await Promise.all([
        api.get<SummaryData>("/api/analytics/summary", token),
        api.get<{ weeks: WeekData[] }>("/api/analytics/over-time", token),
        api.get<{ waterlooworks: StatusItem[]; external: StatusItem[] }>(
          "/api/analytics/status-breakdown",
          token
        ),
        api.get<{ resumes: ResumePerf[] }>(
          "/api/analytics/resume-performance",
          token
        ),
      ]);

      setSummary(summaryRes);
      setWeeks(timeRes.weeks);
      setWwStatus(statusRes.waterlooworks);
      setExtStatus(statusRes.external);
      setResumes(resumeRes.resumes);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Empty state
  if (!loading && summary && summary.total_applications < 3) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your application performance across all sources
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Not enough data yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add more applications to see your analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bestResume = resumes.length
    ? resumes.reduce((best, r) =>
        r.response_rate > best.response_rate ? r : best
      )
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Track your application performance across all sources
        </p>
      </div>

      {/* Top row: 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Applications"
          value={summary?.total_applications ?? 0}
          wwValue={summary ? `${summary.by_source.waterlooworks.total}` : undefined}
          extValue={summary ? `${summary.by_source.external.total}` : undefined}
          loading={loading}
        />
        <StatCard
          title="Response Rate"
          value={summary?.response_rate ?? 0}
          suffix="%"
          wwValue={summary ? `${summary.by_source.waterlooworks.response_rate}%` : undefined}
          extValue={summary ? `${summary.by_source.external.response_rate}%` : undefined}
          loading={loading}
        />
        <StatCard
          title="Interview Rate"
          value={summary?.interview_rate ?? 0}
          suffix="%"
          wwValue={summary ? `${summary.by_source.waterlooworks.interview_rate}%` : undefined}
          extValue={summary ? `${summary.by_source.external.interview_rate}%` : undefined}
          loading={loading}
        />
        <StatCard
          title="Offer / Match Rate"
          value={summary?.offer_rate ?? 0}
          suffix="%"
          wwValue={summary ? `${summary.by_source.waterlooworks.offer_rate}%` : undefined}
          extValue={summary ? `${summary.by_source.external.offer_rate}%` : undefined}
          loading={loading}
        />
      </div>

      {/* Avg days to response */}
      {!loading && summary && summary.average_days_to_response > 0 && (
        <p className="text-sm text-muted-foreground">
          Average time to first response:{" "}
          <span className="font-medium text-foreground">
            {summary.average_days_to_response} days
          </span>
        </p>
      )}

      {/* Applications Over Time */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Applications Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeks}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="waterlooworks"
                    name="WaterlooWorks"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="external"
                    name="External"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Breakdown — two PieCharts side by side */}
      <div className="grid md:grid-cols-2 gap-6">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  WaterlooWorks — Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {wwStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No WaterlooWorks jobs yet.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={wwStatus.map((s) => ({
                            name: STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] || s.status,
                            value: s.count,
                          }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {wwStatus.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  External — Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {extStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No external jobs yet.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={extStatus.map((s) => ({
                            name: STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] || s.status,
                            value: s.count,
                          }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {extStatus.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Resume Performance */}
      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : resumes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resume Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Version</th>
                    <th className="pb-2 font-medium">Uploaded</th>
                    <th className="pb-2 font-medium text-right">Applications</th>
                    <th className="pb-2 font-medium text-right">Response Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {resumes.map((r) => {
                    const isBest =
                      bestResume && r.id === bestResume.id && r.application_count > 0;
                    return (
                      <tr
                        key={r.id}
                        className={`border-b last:border-0 ${
                          isBest
                            ? "bg-green-50 dark:bg-green-950/30"
                            : ""
                        }`}
                      >
                        <td className="py-2">
                          Master v{r.version_number}
                          {isBest && (
                            <span className="ml-2 text-xs text-green-700 dark:text-green-400 font-medium">
                              Best
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-right">{r.application_count}</td>
                        <td className="py-2 text-right font-medium">
                          {r.response_rate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
