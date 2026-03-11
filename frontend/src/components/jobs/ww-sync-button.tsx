"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, AlertTriangle, Loader2, CheckCircle } from "lucide-react";

interface WWSyncButtonProps {
  onSyncComplete: () => void;
  variant?: "outline" | "default";
  size?: "default" | "sm";
}

export function WWSyncButton({
  onSyncComplete,
  variant = "outline",
  size = "default",
}: WWSyncButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
  } | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSync(formData: FormData) {
    setLoading(true);
    setError(null);
    setResult(null);
    setStatus("Logging in...");

    const waterlooId = formData.get("waterloo_id") as string;
    const password = formData.get("password") as string;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      setStatus("Fetching postings...");

      const data = await api.post<{
        jobs_imported: number;
        jobs_updated: number;
      }>("/api/waterlooworks/sync", { waterloo_id: waterlooId, password }, token);

      setStatus(null);
      setResult({ imported: data.jobs_imported, updated: data.jobs_updated });
      setLastSynced(new Date().toLocaleString());
      onSyncComplete();
    } catch (err) {
      setStatus(null);
      setError(
        err instanceof Error ? err.message : "Sync failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setDialogOpen(true)}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Sync WW
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync WaterlooWorks</DialogTitle>
            <DialogDescription>
              Import your active co-op job postings from WaterlooWorks.
            </DialogDescription>
          </DialogHeader>

          {/* Security disclaimer */}
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Your credentials are used only to fetch your job postings and are{" "}
              <strong>never stored.</strong> They are discarded immediately after
              the sync completes.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Sync complete!</span>
              </div>
              <p>
                Imported {result.imported} new job{result.imported !== 1 ? "s" : ""}
                {result.updated > 0 &&
                  `, updated ${result.updated} existing job${result.updated !== 1 ? "s" : ""}`}
              </p>
            </div>
          )}

          {lastSynced && (
            <p className="text-xs text-muted-foreground">
              Last synced: {lastSynced}
            </p>
          )}

          {/* Progress indicator */}
          {loading && status && (
            <div className="flex items-center gap-3 rounded-md border p-3 bg-muted/30">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm">{status}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSync(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="waterloo_id">WaterlooID (Quest username)</Label>
              <Input
                id="waterloo_id"
                name="waterloo_id"
                placeholder="j2doe"
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ww-password">Password</Label>
              <Input
                id="ww-password"
                name="password"
                type="password"
                required
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Sync Now"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
