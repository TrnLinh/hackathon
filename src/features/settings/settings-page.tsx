import { ConvexStatus } from "@/components/convex-status";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { IdentityStatus } from "@/features/auth/auth-status";

const foundation = [
  ["Next.js · TypeScript · Tailwind CSS", "Installed"],
  ["TanStack Router · workspace navigation", "Active"],
  ["shadcn/ui · reusable components", "Ready"],
  ["TideCloak · consent policies", "CH-02 integration pending"],
] as const;

export function SettingsPage() {
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          The foundation
        </p>
        <h1 className="font-serif text-4xl tracking-tight">Project setup</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The starter is ready for the first Chorus implementation.
        </p>
      </div>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Your identity</CardTitle>
          <CardDescription>
            Sign in and confirm the identity verified by the backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IdentityStatus />
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Convex backend</CardTitle>
          <CardDescription>
            Live connection and a typed backend query.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConvexStatus />
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Application foundation</CardTitle>
          <CardDescription>The tools behind this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {foundation.map(([name, status], index) => (
            <div key={name}>
              {index > 0 && <Separator className="my-4" />}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{name}</span>
                <Badge
                  variant={
                    status === "CH-02 integration pending"
                      ? "outline"
                      : "secondary"
                  }
                >
                  {status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
