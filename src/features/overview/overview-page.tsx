import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookHeart,
  FileDown,
  Inbox,
  MessageCircleHeart,
  PenTool,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { TrustNote } from "@/components/chorus/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePrototype } from "@/features/prototype/store";
import {
  firstName,
  inboxFor,
  personById,
} from "@/features/prototype/selectors";

const journey = [
  {
    icon: UsersRound,
    title: "Start a collection",
    description:
      "Create it, share the join link, and admit the people involved.",
  },
  {
    icon: UploadCloud,
    title: "Add memories",
    description:
      "Photos, voice notes, short videos, and stories, prepared on your device.",
  },
  {
    icon: Inbox,
    title: "Everyone decides",
    description:
      "Each person approves manual use and AI processing separately.",
  },
  {
    icon: PenTool,
    title: "Design from memories",
    description:
      "AI proposes a six-page style from approved memories; edit anything.",
  },
  {
    icon: FileDown,
    title: "Approve and download",
    description: "Everyone approves the exact PDF before anyone downloads it.",
  },
];

export function OverviewPage() {
  const state = usePrototype();
  const viewer = personById(state, state.viewerId);
  const waiting = inboxFor(state, state.viewerId).length;
  const demo =
    state.collections.find((c) => c.id === "c-first-year") ??
    state.collections[0];
  return (
    <div className="space-y-9">
      <section className="relative overflow-hidden rounded-2xl border bg-card px-6 py-9 sm:px-9 sm:py-12">
        <Badge variant="secondary" className="mb-6">
          Shared memories. Many voices.
        </Badge>
        <h1 className="max-w-xl font-serif text-4xl leading-[1.15] tracking-tight sm:text-5xl">
          Some stories are better
          <br className="hidden sm:block" /> told together.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
          Your memories inspire the design. Everyone involved has a say in the
          story.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {demo && (
            <Button asChild size="lg">
              <Link
                to="/collections/$collectionId"
                params={{ collectionId: demo.id }}
              >
                Open “{demo.title}” <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link to="/approvals">
              {waiting > 0
                ? `${waiting} waiting for ${firstName(viewer)}`
                : "Approvals inbox"}
            </Link>
          </Button>
        </div>
        <MessageCircleHeart
          className="pointer-events-none absolute -right-7 -bottom-8 size-44 rotate-[-12deg] text-primary/5"
          aria-hidden="true"
        />
      </section>
      <section aria-labelledby="how-it-works">
        <h2
          id="how-it-works"
          className="mb-4 text-lg font-semibold tracking-tight"
        >
          From a moment to a keepsake
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {journey.map(({ icon: Icon, title, description }, index) => (
            <li key={title}>
              <Card className="h-full shadow-none">
                <CardHeader>
                  <div className="mb-3 flex items-center justify-between">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                    <span className="font-mono text-xs text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <CardTitle className="text-sm leading-snug">
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {description}
                  </CardDescription>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>
      <section
        aria-labelledby="demo-tips"
        className="grid gap-4 md:grid-cols-2"
      >
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle
              id="demo-tips"
              className="flex items-center gap-2 text-sm"
            >
              <BookHeart className="size-4 text-primary" aria-hidden="true" />
              Trying the prototype
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              Use <strong className="text-foreground">Viewing as</strong> in the
              header to switch between Maya, Leo, Priya, and Sam and see each
              person’s inbox and decisions.
            </p>
            <p>
              Turn the designer offline under AI processors to rehearse the
              manual recovery path. The reset button restores the seed data.
            </p>
          </CardContent>
        </Card>
        <TrustNote className="h-full">
          This is a UI prototype with synthetic data stored in your browser.
          Consent, Tide-protected release, encryption, AI inference, PDF
          rendering, and receipt signatures are simulated. They are not verified
          protections until CH-02 through CH-21 integrate the real services.
        </TrustNote>
      </section>
    </div>
  );
}
