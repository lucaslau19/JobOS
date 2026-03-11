import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">
          Job<span className="text-primary">OS</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-lg">
          AI-powered job search tracker for UWaterloo co-op students. Unify
          WaterlooWorks and external applications in one dashboard.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/auth">
          <Button size="lg">Get Started</Button>
        </Link>
        <Link href="/auth?tab=login">
          <Button size="lg" variant="outline">
            Sign In
          </Button>
        </Link>
      </div>
    </div>
  );
}
