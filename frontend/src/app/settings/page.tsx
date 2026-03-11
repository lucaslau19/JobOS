"use client";

import { WWSyncButton } from "@/components/jobs/ww-sync-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your WaterlooWorks sync and account preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>WaterlooWorks Sync</CardTitle>
          <CardDescription>
            Import your active co-op job postings from WaterlooWorks. Your
            credentials are never stored — they are used only for the sync
            session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WWSyncButton onSyncComplete={() => {}} />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>
            JobOS is an AI-powered job search tracker designed for University of
            Waterloo co-op students. It unifies WaterlooWorks and external job
            applications into one intelligent dashboard.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
