import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, PenTool, Save } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { MemoryStatusBadge } from "@/components/chorus/status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  buildTemplatePlan,
  commitPlan,
  templates,
  type DesignPlan,
  type PlanError,
  type TemplateContent,
} from "@/lib/design-plan";
import { formatTime } from "@/features/data/backend";
import { useCollection } from "@/features/data/collections";
import { useViewer } from "@/features/data/current-user";
import {
  useMediaUrl,
  useMemories,
  type MemoryView,
} from "@/features/data/memories";
import { usePlans, useSavePlan } from "@/features/data/plans";
import { LocalConsentNote } from "@/features/memories/convex-memories";

// CH-09 Template mode for collections on Convex. Plans are built from
// sources every person in them approved for this creator, use the shared
// DesignPlan contract and validator, and never call a model. The server checks
// the sources a save declares; it can't read the body, so CH-10's freeze must
// verify the body's assets equal the recorded lineage. Manual layout,
// palette and font controls are not wired for Convex yet.

const fontStack: Record<string, string> = {
  serif: "var(--font-serif)",
  hand: "var(--font-hand)",
  grotesk: "var(--font-grotesk)",
  mono: "var(--font-mono)",
  sans: "var(--font-sans)",
};

type DraftInputs = {
  /** Template and sources the draft was built from. */
  key: string;
  templateId: string;
  templateVersion: string;
  sources: MemoryView[];
};

const clip = (text: string, max: number) =>
  Array.from(text).slice(0, max).join("");

function PlanImage({ versionId, alt }: { versionId: string; alt: string }) {
  const url = useMediaUrl(versionId as Id<"memoryVersions">);
  if (!url) return <div className="size-full bg-black/10" />;
  // Protected, short-lived storage URL; next/image would proxy and cache it.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-full object-cover" />;
}

/** On-screen preview of the exact plan; the PDF renderer is CH-10. */
function PlanPreview({
  plan,
  titles,
}: {
  plan: DesignPlan;
  titles: Map<string, string>;
}) {
  const style = plan.style;
  return (
    <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Pages">
      {plan.pages.map((page, i) => (
        <li key={i} className="space-y-1">
          <div
            className="relative w-full overflow-hidden rounded-md border shadow-sm"
            style={{
              aspectRatio: `${page.widthMm} / ${page.heightMm}`,
              background: style.paper,
              color: style.ink,
            }}
          >
            {page.components.map((c) => {
              const box = {
                left: `${(c.frame.x / page.widthMm) * 100}%`,
                top: `${(c.frame.y / page.heightMm) * 100}%`,
                width: `${(c.frame.w / page.widthMm) * 100}%`,
                height: `${(c.frame.h / page.heightMm) * 100}%`,
              };
              const asset = "assets" in c ? c.assets[0] : undefined;
              const text = "text" in c ? c.text.value : "";
              return (
                <div
                  key={c.id}
                  className="absolute overflow-hidden"
                  style={box}
                >
                  {asset ? (
                    <PlanImage
                      versionId={asset.id}
                      alt={titles.get(asset.id) ?? "Memory"}
                    />
                  ) : "assets" in c && c.kind !== "cover" ? (
                    <div
                      className="grid size-full place-items-center border border-dashed text-[9px] opacity-60"
                      style={{ borderColor: style.muted }}
                    >
                      Empty slot
                    </div>
                  ) : null}
                  {text && (
                    <p
                      className={cn(
                        "absolute inset-0 overflow-hidden p-1 leading-tight",
                        c.kind === "cover" || c.kind === "heading"
                          ? "text-sm font-semibold"
                          : "text-[10px]",
                      )}
                      style={{
                        fontFamily:
                          fontStack[
                            c.kind === "cover" || c.kind === "heading"
                              ? style.headingFont
                              : style.bodyFont
                          ],
                        color: c.kind === "cover" ? style.accent : style.ink,
                      }}
                    >
                      {c.kind === "quote" ? `“${text}”` : text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Page {i + 1} · {page.role}
          </p>
        </li>
      ))}
    </ol>
  );
}

function templateContent(
  title: string,
  occasion: string,
  sources: MemoryView[],
): TemplateContent {
  const content: TemplateContent = {
    title: clip(title, 80),
    occasion: clip(occasion, 80),
    visuals: [],
    quotes: [],
  };
  for (const m of sources) {
    if (!m.head) continue;
    const asset = { kind: "version" as const, id: m.head.versionId };
    if (m.kind === "photo")
      content.visuals.push({
        asset,
        ...(m.head.caption
          ? {
              caption: {
                value: clip(m.head.caption, 240),
                creditId: m.uploaderId,
                source: { asset },
              },
            }
          : {}),
      });
    else if (m.kind === "text" && m.head.story)
      content.quotes.push({
        value: clip(m.head.story, 240),
        creditId: m.uploaderId,
        source: { asset },
      });
  }
  return content;
}

export function ConvexComposer({ collectionId }: { collectionId: string }) {
  const collection = useCollection(collectionId);
  const viewer = useViewer();
  const member = collection?.access === "member" ? collection : null;
  const memories = useMemories(member?.collectionId ?? null);
  const plans = usePlans(
    member?.role === "creator" ? member.collectionId : null,
  );
  const savePlan = useSavePlan();
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [viewing, setViewing] = useState<string | null>(null);
  // A draft carries the inputs it was built from, so Save never pairs a plan
  // with a template or source list chosen after it was built.
  const [draft, setDraft] = useState<
    | ({ ok: true; plan: DesignPlan; digest: string } & DraftInputs)
    | ({ ok: false; errors: PlanError[] } & DraftInputs)
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Sources this creator may compose with: approved for them, current version.
  const available = useMemo(
    () =>
      (memories ?? []).filter(
        (m) =>
          m.head &&
          m.permission?.status === "approved" &&
          m.permission.editorId === viewer?.userId,
      ),
    [memories, viewer],
  );
  const included = available.filter((m) => !excluded.has(m.memoryId));
  const titles = useMemo(
    () => new Map(available.map((m) => [m.head!.versionId, m.head!.title])),
    [available],
  );
  const template = templates.find((t) => t.id === templateId)!;

  const includedKey = included.map((m) => m.memoryId).join();
  useEffect(() => {
    if (!member) return;
    let active = true;
    const inputs: DraftInputs = {
      templateId: template.id,
      templateVersion: template.version,
      sources: included,
      key: `${template.id}|${includedKey}`,
    };
    const plan = buildTemplatePlan(
      template.id,
      templateContent(
        member.metadata.title,
        member.metadata.occasion,
        included,
      ),
    );
    void commitPlan(plan, {
      authorizedAssets: included.map((m) => ({
        kind: "version",
        id: m.head!.versionId,
      })),
      people: member.members.map((p) => p.userId),
      allowEmptySlots: true,
    }).then((result) => {
      if (active) setDraft({ ...result, ...inputs });
    });
    return () => {
      active = false;
    };
    // Rebuild only when the inputs that shape the plan change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.collectionId, template.id, includedKey]);

  if (!collection || !viewer || !memories)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Opening the composer…
      </p>
    );
  if (!member || member.role !== "creator")
    return (
      <EmptyState
        icon={<PenTool className="size-5" aria-hidden="true" />}
        title="The collection’s creator composes the photozine"
      >
        You’ll be asked to approve the final edition before anyone can download
        it.
      </EmptyState>
    );

  // Save only the plan built from the current template and sources.
  const fresh = draft?.key === `${template.id}|${includedKey}`;
  const shown = viewing
    ? plans?.find((p) => p.planId === viewing)?.plan
    : draft?.ok
      ? draft.plan
      : null;

  async function save() {
    if (!member || !draft?.ok || !fresh || saving) return;
    setSaving(true);
    setMessage(null);
    const placed = new Set(draft.plan.influence.visible.map((a) => a.id));
    const result = await savePlan({
      collectionId: member.collectionId,
      plan: draft.plan,
      digest: draft.digest,
      origin: {
        kind: "template",
        templateId: draft.templateId,
        templateVersion: draft.templateVersion,
      },
      sourceUses: draft.sources
        .filter((m) => placed.has(m.head!.versionId))
        .map((m) => ({
          permissionId: m.permission!.permissionId,
          influence: "visible" as const,
        })),
    });
    setSaving(false);
    setMessage(result.ok ? "Saved as a new revision." : result.reason);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {viewing ? "Saved revision" : `Template: ${template.name}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              Six A5 pages, built without AI from memories everyone approved.
            </p>
          </div>
          {viewing ? (
            <Button variant="outline" onClick={() => setViewing(null)}>
              Back to the draft
            </Button>
          ) : (
            <Button
              disabled={!draft?.ok || !fresh || saving}
              onClick={() => void save()}
            >
              <Save aria-hidden="true" /> {saving ? "Saving…" : "Save revision"}
            </Button>
          )}
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {!viewing && draft && !draft.ok && (
          <Alert variant="destructive" role="alert">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>This draft can’t be saved yet</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {draft.errors.slice(0, 6).map((e) => (
                  <li key={`${e.path}:${e.code}`}>
                    {e.message} ({e.path})
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {shown ? (
          <PlanPreview plan={shown} titles={titles} />
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Building the pages…
          </p>
        )}
      </div>

      <aside className="space-y-4">
        <section className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Template</h2>
          <div className="grid gap-2">
            {templates.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={
                  t.id === templateId && !viewing ? "default" : "outline"
                }
                onClick={() => {
                  setViewing(null);
                  setTemplateId(t.id);
                }}
              >
                {t.name}
              </Button>
            ))}
          </div>
        </section>
        <section className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">
            Approved memories ({included.length}/{available.length})
          </h2>
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              None yet. Memories appear here once everyone in them approves. The
              template still works with empty slots.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {available.map((m) => (
                <li key={m.memoryId}>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={!excluded.has(m.memoryId)}
                      onCheckedChange={(on) =>
                        setExcluded((prev) => {
                          const next = new Set(prev);
                          if (on) next.delete(m.memoryId);
                          else next.add(m.memoryId);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {m.head!.title}
                    </span>
                    <MemoryStatusBadge status={m.status} />
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Photos fill picture slots; stories become quotes credited to their
            writer. Voice and video need stills or excerpts (not yet on the
            backend).
          </p>
        </section>
        <section className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">
            Revisions ({plans?.length ?? 0})
          </h2>
          <ol className="space-y-1.5 text-xs">
            {(plans ?? []).map((p, i) => (
              <li key={p.planId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
                  onClick={() => setViewing(p.planId)}
                >
                  <span>
                    Revision {(plans?.length ?? 0) - i} ·{" "}
                    {p.revisionOrigin === "template" ? "Template" : "Manual"}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {p.usable ? (
                      <CheckCircle2
                        className="size-3 text-[var(--status-available)]"
                        aria-label="Sources still approved"
                      />
                    ) : (
                      <Badge variant="outline">Source withdrawn</Badge>
                    )}
                    {formatTime(p.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Revisions are immutable. A withdrawn source makes every revision
            that used it unusable.
          </p>
        </section>
        <LocalConsentNote />
        <TrustNote>
          No model is called. Only you, the creator, can open plans in the app,
          but they’re stored unencrypted for development, so deployment
          operators could read them.
        </TrustNote>
      </aside>
    </div>
  );
}
