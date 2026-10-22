import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function CollectionsPage() {
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          The moments you keep
        </p>
        <h1 className="font-serif text-4xl tracking-tight">Your collections</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A place for shared photos, little stories, and everyone’s perspective.
        </p>
      </div>
      <Card className="border-dashed shadow-none">
        <CardContent className="flex flex-col items-center px-6 py-16 text-center">
          <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-secondary">
            <BookOpen className="size-6 text-primary" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">A new chapter starts here</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Collection creation is coming next. Connect the project services,
            then build the first encrypted contribution and approval flow.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/settings">
              View project setup <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
