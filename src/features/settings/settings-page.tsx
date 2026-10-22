import { RotateCcw } from "lucide-react";
import { ConvexStatus } from "@/components/convex-status";
import { PageHeader } from "@/components/chorus/page-header";
import { Disclosure } from "@/components/chorus/primitives";
import { Button } from "@/components/ui/button";
import { IdentityStatus } from "@/features/auth/auth-status";
import { actions } from "@/features/prototype/store";

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rise space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <PageHeader title="Settings" />

      <Group title="Demo data">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-muted-foreground">
            Go back to the starting memories and people.
          </p>
          <Button variant="outline" onClick={() => actions.reset()}>
            <RotateCcw aria-hidden="true" /> Reset demo
          </Button>
        </div>
      </Group>

      <Group title="Connection status">
        <div className="space-y-4 text-sm">
          <IdentityStatus />
          <ConvexStatus />
        </div>
      </Group>

      <Group title="About this demo">
        <p className="text-base text-muted-foreground">
          Consent, encryption, AI, PDF rendering, and proof signatures are
          simulated here.
        </p>
        <Disclosure summary="What is real">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>All data is synthetic and stored in your browser.</li>
            <li>Tide-protected release is not connected yet.</li>
            <li>AI starts off, and templates work without it.</li>
            <li>Proofs of approval are placeholders, not real signatures.</li>
          </ul>
        </Disclosure>
      </Group>
    </div>
  );
}
