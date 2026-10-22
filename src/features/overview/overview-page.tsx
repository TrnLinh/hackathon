import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookHeart,
  Images,
  MessageCircleHeart,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const steps = [
  {
    icon: Images,
    title: "Gather the little things",
    description: "Photos, inside jokes, and stories worth holding on to.",
  },
  {
    icon: UsersRound,
    title: "Make space for every voice",
    description: "Let the people in each memory decide how it is used.",
  },
  {
    icon: BookHeart,
    title: "Keep something together",
    description: "Turn the collection into a photozine to save and share.",
  },
];

export function OverviewPage() {
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
          A first year away from home. A farewell. The trip you still talk
          about. Make a little book of the moments that made you, together.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/collections">
              Explore collections <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/settings">Project setup</Link>
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
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <Card key={title} className="shadow-none">
              <CardHeader>
                <div className="mb-3 flex items-center justify-between">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <span className="font-mono text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <CardTitle className="text-sm leading-snug">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        This is the Chorus project starter. Memory uploads, contributor consent,
        TideCloak protection, and PDF export are the next implementation
        milestones.
      </p>
    </div>
  );
}
