"use client";

import { useSyncExternalStore } from "react";
import { createSeedState } from "./fixtures";
import { buildTemplatePlan, templateById } from "./templates";
import {
  aiEligible,
  approverIds,
  finalApproverIds,
  planInfluenceIds,
  planVisibleIds,
} from "./selectors";
import type {
  ApproverDecisions,
  Collection,
  DesignPlan,
  FinalDecision,
  HistoryEvent,
  Memory,
  MemoryKind,
  PersonId,
  Processor,
  ProcessorId,
  PrototypeState,
  StyleTokens,
  TranscriptExcerpt,
} from "./types";

// In-memory prototype store persisted to localStorage so drafts survive a
// refresh. It simulates outcomes for UI work only; it is not an authority for
// consent, release, or issuance.

const STORAGE_KEY = "chorus-prototype-v2";
const listeners = new Set<() => void>();
let state: PrototypeState = createSeedState();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      state = JSON.parse(saved) as PrototypeState;
      // Simulated jobs run on in-page timers, so a reload interrupts them.
      // Never leave one "running": that would block new jobs indefinitely.
      for (const job of state.jobs)
        if (job.status === "running" || job.status === "queued") {
          job.status = "failed";
          job.error =
            "Interrupted when the page reloaded. No result was applied; retry or continue manually.";
        }
    }
  } catch {
    // Corrupt or unavailable storage falls back to seed data.
  }
}

function commit(next: PrototypeState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota or privacy mode: keep the in-memory state.
  }
  listeners.forEach((l) => l());
}

/** Feature-local prototype actions may use this to apply an immutable update. */
export function updatePrototype(recipe: (draft: PrototypeState) => void) {
  update(recipe);
}

function update(recipe: (draft: PrototypeState) => void) {
  hydrate();
  const draft = structuredClone(state);
  recipe(draft);
  commit(draft);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverSnapshot = createSeedState();

/**
 * Returns the whole prototype state. The reference is stable between updates,
 * so derive values in render (or with useMemo) instead of selecting here.
 */
export function usePrototype(): PrototypeState {
  hydrate();
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverSnapshot,
  );
}

export function getPrototypeState() {
  hydrate();
  return state;
}

let counter = 0;
function uid(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter}`;
}

function now() {
  return new Date().toISOString();
}

function log(
  draft: PrototypeState,
  event: Omit<HistoryEvent, "id" | "at"> & { at?: string },
) {
  draft.history.push({ id: uid("h"), at: event.at ?? now(), ...event });
}

/** Synthetic SHA-256-looking digest. Not a real hash. */
function fakeDigest(seed: string) {
  let h = 2166136261;
  let out = "";
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i) + round;
      h = Math.imul(h, 16777619);
    }
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out;
}

function invalidateDependents(
  draft: PrototypeState,
  memoryId: string,
  reason: string,
) {
  for (const plan of draft.plans) {
    if (!plan.invalidatedReason && planInfluenceIds(plan).includes(memoryId)) {
      plan.invalidatedReason = reason;
      log(draft, {
        collectionId: plan.collectionId,
        actorId: "system",
        kind: "plan.invalidated",
        summary: `Design revision ${plan.revision} invalidated: ${reason}`,
        resource: `${plan.id} r${plan.revision}`,
      });
    }
  }
  for (const cand of draft.candidates) {
    const depends =
      cand.visibleIds.includes(memoryId) ||
      cand.styleOnlyIds.includes(memoryId);
    if (depends && cand.status === "in-review") {
      cand.status = "invalidated";
      cand.invalidatedReason = reason;
      log(draft, {
        collectionId: cand.collectionId,
        actorId: "system",
        kind: "candidate.invalidated",
        summary: `Candidate ${cand.editionId} invalidated: ${reason}`,
        resource: cand.editionId,
      });
    }
  }
  for (const job of draft.jobs) {
    if (
      (job.status === "queued" || job.status === "running") &&
      job.memoryIds.includes(memoryId)
    ) {
      job.status = "cancelled";
      job.error =
        "Cancelled after a permission change. Late results will be discarded.";
    }
  }
}

const STYLE_PRESETS: Record<string, StyleTokens> = {
  scrapbook: {
    name: "Warm scrapbook",
    paper: "#fbf3e6",
    ink: "#3b2a22",
    accent: "#d9643a",
    muted: "#b9926f",
    headingFont: "hand",
    bodyFont: "serif",
    texture: "tape",
  },
  editorial: {
    name: "Bold editorial",
    paper: "#111111",
    ink: "#f5f5f5",
    accent: "#ff2e88",
    muted: "#13e2d0",
    headingFont: "grotesk",
    bodyFont: "sans",
    texture: "grain",
  },
  film: {
    name: "Quiet film",
    paper: "#eef0ea",
    ink: "#23302a",
    accent: "#4f7a64",
    muted: "#93a596",
    headingFont: "serif",
    bodyFont: "serif",
    texture: "film",
  },
  playful: {
    name: "Playful zine",
    paper: "#fff7d6",
    ink: "#2b2140",
    accent: "#ff6b4a",
    muted: "#6c9cff",
    headingFont: "hand",
    bodyFont: "sans",
    texture: "tape",
  },
};

export const stylePresets = STYLE_PRESETS;

function pickTokens(prompt: string | undefined, fallback: string): StyleTokens {
  const p = (prompt ?? "").toLowerCase();
  if (/(play|fun|bright|silly)/.test(p)) return STYLE_PRESETS.playful;
  if (/(bold|neon|edgy|dark|editorial)/.test(p)) return STYLE_PRESETS.editorial;
  if (/(quiet|calm|minimal|film|soft)/.test(p)) return STYLE_PRESETS.film;
  return STYLE_PRESETS[fallback] ?? STYLE_PRESETS.scrapbook;
}

export const actions = {
  reset() {
    hydrate();
    commit(createSeedState());
  },

  setViewer(id: PersonId) {
    update((d) => {
      d.viewerId = id;
    });
  },

  createCollection(input: { title: string; occasion: string }) {
    const id = uid("c");
    update((d) => {
      const collection: Collection = {
        id,
        title: input.title,
        occasion: input.occasion,
        creatorId: d.viewerId,
        memberIds: [d.viewerId],
        pendingIds: [],
        joinCode:
          Math.random().toString(36).slice(2, 6).toUpperCase() +
          "-" +
          Math.random().toString(36).slice(2, 6).toUpperCase(),
        createdAt: now(),
      };
      d.collections.unshift(collection);
      log(d, {
        collectionId: id,
        actorId: d.viewerId,
        kind: "collection.created",
        summary: "Created the collection",
      });
    });
    return id;
  },

  requestJoin(collectionId: string) {
    update((d) => {
      const c = d.collections.find((x) => x.id === collectionId);
      if (
        !c ||
        c.memberIds.includes(d.viewerId) ||
        c.pendingIds.includes(d.viewerId)
      )
        return;
      c.pendingIds.push(d.viewerId);
      log(d, {
        collectionId,
        actorId: d.viewerId,
        kind: "member.joined",
        summary: "Asked to join with the collection link",
      });
    });
  },

  admitMember(collectionId: string, personId: PersonId) {
    update((d) => {
      const c = d.collections.find((x) => x.id === collectionId);
      if (!c) return;
      c.pendingIds = c.pendingIds.filter((id) => id !== personId);
      if (!c.memberIds.includes(personId)) c.memberIds.push(personId);
      log(d, {
        collectionId,
        actorId: d.viewerId,
        kind: "member.admitted",
        summary: `Admitted ${d.people.find((p) => p.id === personId)?.name}`,
      });
    });
  },

  declineJoin(collectionId: string, personId: PersonId) {
    update((d) => {
      const c = d.collections.find((x) => x.id === collectionId);
      if (c) c.pendingIds = c.pendingIds.filter((id) => id !== personId);
    });
  },

  removeMember(collectionId: string, personId: PersonId) {
    update((d) => {
      const c = d.collections.find((x) => x.id === collectionId);
      if (!c || c.creatorId === personId) return;
      c.memberIds = c.memberIds.filter((id) => id !== personId);
      log(d, {
        collectionId,
        actorId: d.viewerId,
        kind: "member.removed",
        summary: `Removed ${d.people.find((p) => p.id === personId)?.name}. Previously approved audiences are unchanged.`,
      });
    });
  },

  addMemory(input: {
    collectionId: string;
    kind: MemoryKind;
    title: string;
    caption: string;
    story: string;
    peopleIds: PersonId[];
    requestedProcessors: ProcessorId[];
    media?: Memory["media"];
    art?: Memory["art"];
    submit: boolean;
  }) {
    const id = uid("m");
    update((d) => {
      const peopleIds = Array.from(new Set([d.viewerId, ...input.peopleIds]));
      const memory: Memory = {
        id,
        collectionId: input.collectionId,
        kind: input.kind,
        title: input.title,
        caption: input.caption,
        story: input.story,
        uploaderId: d.viewerId,
        peopleIds,
        version: 1,
        versions: [{ version: 1, createdAt: now(), note: "Original upload" }],
        createdAt: now(),
        submitted: input.submit,
        media: input.media,
        art: input.art,
        requestedProcessors: input.requestedProcessors,
        decisions: {},
        transcript:
          input.kind === "voice" || input.kind === "video" ? [] : undefined,
        stills:
          input.kind === "video" && input.art
            ? [2, 7, 12, 17, 22, 27].map((t, i) => ({
                id: uid("s"),
                atSec: t,
                art: {
                  ...input.art!,
                  scene: `0:${String(t).padStart(2, "0")}`,
                },
                selected: i < 3,
              }))
            : undefined,
      };
      d.memories.push(memory);
      log(d, {
        collectionId: input.collectionId,
        actorId: d.viewerId,
        kind: "memory.added",
        summary: `Added a ${input.kind} memory${input.submit ? " and requested approval" : " as a private draft"}`,
        resource: `${id} v1`,
      });
    });
    return id;
  },

  submitMemory(memoryId: string) {
    update((d) => {
      const m = d.memories.find((x) => x.id === memoryId);
      if (m) m.submitted = true;
    });
  },

  /** Any content, people, or scope change creates a new version with fresh decisions. */
  reviseMemory(
    memoryId: string,
    patch: Partial<
      Pick<
        Memory,
        "title" | "caption" | "story" | "peopleIds" | "requestedProcessors"
      >
    >,
    note: string,
  ) {
    update((d) => {
      const m = d.memories.find((x) => x.id === memoryId);
      if (!m) return;
      Object.assign(m, patch);
      m.peopleIds = Array.from(new Set([m.uploaderId, ...m.peopleIds]));
      m.version += 1;
      m.versions.push({ version: m.version, createdAt: now(), note });
      m.decisions = {};
      d.permissionRevision += 1;
      invalidateDependents(d, memoryId, "a source memory changed");
      log(d, {
        collectionId: m.collectionId,
        actorId: d.viewerId,
        kind: "memory.revised",
        summary: `Published version ${m.version}; earlier approvals do not carry over`,
        resource: `${m.id} v${m.version}`,
      });
    });
  },

  decide(memoryId: string, decisions: ApproverDecisions) {
    update((d) => {
      const m = d.memories.find((x) => x.id === memoryId);
      if (!m) return;
      m.decisions[d.viewerId] = { ...decisions, decidedAt: now() };
      d.permissionRevision += 1;
      const declinedAny =
        decisions.manual === "declined" ||
        Object.values(decisions.processors).includes("declined");
      log(d, {
        collectionId: m.collectionId,
        actorId: d.viewerId,
        kind: declinedAny ? "decision.declined" : "decision.approved",
        summary:
          decisions.manual === "declined"
            ? "Declined use"
            : declinedAny
              ? "Approved manual use; declined some AI processing"
              : "Approved manual use and requested AI processing",
        resource: `${m.id} v${m.version}`,
      });
    });
  },

  requestEdit(memoryId: string) {
    update((d) => {
      const m = d.memories.find((x) => x.id === memoryId);
      if (!m) return;
      m.decisions[d.viewerId] = {
        manual: "pending",
        processors: {},
        editRequested: true,
        decidedAt: now(),
      };
      log(d, {
        collectionId: m.collectionId,
        actorId: d.viewerId,
        kind: "decision.edit-requested",
        summary: "Requested an edit",
        resource: `${m.id} v${m.version}`,
      });
    });
  },

  withdraw(memoryId: string, scope: "all" | "ai") {
    update((d) => {
      const m = d.memories.find((x) => x.id === memoryId);
      if (!m) return;
      const prev = m.decisions[d.viewerId] ?? {
        manual: "pending",
        processors: {},
      };
      const processors = Object.fromEntries(
        m.requestedProcessors.map((p) => [p, "withdrawn"]),
      ) as ApproverDecisions["processors"];
      m.decisions[d.viewerId] = {
        manual: scope === "all" ? "withdrawn" : prev.manual,
        processors,
        decidedAt: now(),
      };
      d.permissionRevision += 1;
      log(d, {
        collectionId: m.collectionId,
        actorId: d.viewerId,
        kind: "decision.withdrawn",
        summary:
          scope === "all"
            ? "Withdrew permission for all future use"
            : "Withdrew AI processing permission",
        resource: `${m.id} v${m.version}`,
      });
      invalidateDependents(d, memoryId, "a contributor withdrew permission");
      // Issued editions stay downloadable only under current permission.
      for (const cand of d.candidates)
        if (
          cand.status === "issued" &&
          (cand.visibleIds.includes(memoryId) ||
            cand.styleOnlyIds.includes(memoryId)) &&
          scope === "all"
        )
          cand.invalidatedReason =
            "A contributor withdrew permission; new app downloads are blocked.";
    });
  },

  updateExcerpt(
    memoryId: string,
    excerptId: string,
    patch: Partial<TranscriptExcerpt>,
  ) {
    update((d) => {
      const ex = d.memories
        .find((x) => x.id === memoryId)
        ?.transcript?.find((e) => e.id === excerptId);
      if (ex) Object.assign(ex, patch);
    });
  },

  toggleStill(memoryId: string, stillId: string) {
    update((d) => {
      const still = d.memories
        .find((x) => x.id === memoryId)
        ?.stills?.find((s) => s.id === stillId);
      if (still) still.selected = !still.selected;
    });
  },

  setProcessorHealth(id: ProcessorId, health: Processor["health"]) {
    update((d) => {
      const p = d.processors.find((x) => x.id === id);
      if (p) p.health = health;
    });
  },

  /**
   * Simulates a design job. Only AI-eligible memories are included. Fails
   * without contacting another provider when a processor is offline.
   */
  generateDesign(collectionId: string, prompt?: string) {
    const s = getPrototypeState();
    // Server-authoritative gate at admission (FR-32). The UI hides the
    // action too, but hiding a button is not the control.
    if (!s.aiConfig.enabled)
      return {
        ok: false as const,
        reason:
          "AI is turned off for this workspace. Template creation and manual editing remain available.",
      };
    if (
      s.jobs.some(
        (j) =>
          j.collectionId === collectionId &&
          (j.status === "queued" || j.status === "running"),
      )
    )
      return {
        ok: false as const,
        reason: "Another AI job is already running for this collection.",
      };
    const eligible = s.memories.filter(
      (m) => m.collectionId === collectionId && aiEligible(m),
    );
    if (eligible.length === 0)
      return {
        ok: false as const,
        reason:
          "No memories have AI permission yet. Continue manually or wait for approvals.",
      };
    const jobId = uid("j");
    update((d) => {
      d.jobs.push({
        id: jobId,
        collectionId,
        processorId: "designer",
        label: prompt
          ? `Refine design: “${prompt.slice(0, 40)}”`
          : `Generate design from ${eligible.length} memories`,
        status: "running",
        createdAt: now(),
        memoryIds: eligible.map((m) => m.id),
        configRevision: d.aiConfig.revision,
      });
      log(d, {
        collectionId,
        actorId: "system",
        kind: "job.dispatched",
        summary: `Sent approved derivatives of ${eligible.length} memories to Team designer`,
      });
    });
    window.setTimeout(() => {
      update((d) => {
        const job = d.jobs.find((j) => j.id === jobId);
        if (!job || job.status !== "running") return; // cancelled: discard late result
        // A disable (or any config change) after admission invalidates the
        // job; its late result never enters the draft, even after re-enable.
        if (!d.aiConfig.enabled || d.aiConfig.revision !== job.configRevision) {
          job.status = "cancelled";
          job.error =
            "Invalidated because the AI configuration changed. The late result was discarded.";
          log(d, {
            collectionId,
            actorId: "system",
            kind: "job.invalidated",
            summary: "Discarded a late design result after AI was turned off",
          });
          return;
        }
        const designer = d.processors.find((p) => p.id === "designer");
        if (designer?.health === "offline") {
          job.status = "failed";
          job.error =
            "Team designer is offline. No content was sent to another provider. Retry later or continue manually.";
          log(d, {
            collectionId,
            actorId: "system",
            kind: "job.failed",
            summary: "Design job failed; manual editing remains available",
          });
          return;
        }
        const still = d.memories.filter(
          (m) => job.memoryIds.includes(m.id) && aiEligible(m),
        );
        const prev = d.plans
          .filter((p) => p.collectionId === collectionId)
          .sort((a, b) => b.revision - a.revision)[0];
        const tokens = pickTokens(
          prompt,
          collectionId === "c-neon" ? "editorial" : "scrapbook",
        );
        const plan = buildPlanFromMemories(
          d,
          collectionId,
          still,
          tokens,
          (prev?.revision ?? 0) + 1,
          prompt,
        );
        plan.parentRevision = prev?.revision;
        plan.aiLineage = true;
        d.plans.push(plan);
        job.status = "succeeded";
        log(d, {
          collectionId,
          actorId: "system",
          kind: "plan.created",
          summary: `Design revision ${plan.revision} created (${tokens.name})`,
          resource: `${plan.id} r${plan.revision}`,
        });
      });
    }, 2200);
    return { ok: true as const, jobId };
  },

  /**
   * Operator-only runtime AI switch (CH-22). Disabling cancels queued work and
   * invalidates running jobs. Re-enabling never resumes them and never
   * processes existing manual drafts. It grants no contributor consent.
   */
  setAiEnabled(enabled: boolean) {
    const s = getPrototypeState();
    const viewer = s.people.find((p) => p.id === s.viewerId);
    if (!viewer?.operator)
      return {
        ok: false as const,
        reason: "Only an authorized operator can change AI availability.",
      };
    if (enabled && !s.aiConfig.processorsConfigured)
      return {
        ok: false as const,
        reason: "Configure processor roles before enabling AI.",
      };
    update((d) => {
      if (d.aiConfig.enabled === enabled) return;
      d.aiConfig = {
        ...d.aiConfig,
        enabled,
        revision: d.aiConfig.revision + 1,
        changedAt: now(),
        changedBy: d.viewerId,
      };
      let invalidated = 0;
      if (!enabled)
        for (const job of d.jobs)
          if (job.status === "queued" || job.status === "running") {
            job.status = "cancelled";
            job.error =
              "Invalidated because AI was turned off. Anything already sent can’t be recalled; a late result will be discarded.";
            invalidated += 1;
          }
      log(d, {
        collectionId: "*",
        actorId: d.viewerId,
        kind: enabled ? "ai.enabled" : "ai.disabled",
        summary: enabled
          ? `Turned AI on (configuration revision ${d.aiConfig.revision}). No job resumes automatically.`
          : `Turned AI off (configuration revision ${d.aiConfig.revision})${invalidated ? `; invalidated ${invalidated} job${invalidated === 1 ? "" : "s"}` : ""}. Template creation stays available.`,
        resource: `ai-config r${d.aiConfig.revision}`,
      });
    });
    return { ok: true as const };
  },

  /** Builds a deterministic template plan. Never contacts a model. */
  startTemplate(
    collectionId: string,
    templateId: string,
    options: { empty?: boolean } = {},
  ) {
    const id = uid("plan");
    update((d) => {
      const latest = d.plans
        .filter((p) => p.collectionId === collectionId)
        .reduce((max, p) => Math.max(max, p.revision), 0);
      const plan = buildTemplatePlan(d, collectionId, templateId, {
        id,
        revision: latest + 1,
        empty: options.empty,
      });
      d.plans.push(plan);
      log(d, {
        collectionId,
        actorId: d.viewerId,
        kind: "plan.created",
        summary: `Started design revision ${plan.revision} from the ${templateById(templateId)?.name ?? "selected"} template${options.empty ? " (empty draft)" : ""}`,
        resource: `${id} r${plan.revision}`,
      });
    });
    return id;
  },

  /**
   * Adds an excerpt typed by a person while listening or watching locally.
   * No transcription service is involved (CH-05, AT-08).
   */
  addManualExcerpt(
    memoryId: string,
    excerpt: Pick<
      TranscriptExcerpt,
      "startSec" | "endSec" | "text" | "speakerId"
    >,
  ) {
    const id = uid("x");
    update((d) => {
      const m = d.memories.find((x) => x.id === memoryId);
      if (!m) return;
      m.transcript = [
        ...(m.transcript ?? []),
        { id, ...excerpt, reviewed: true, source: "manual" },
      ];
    });
    return id;
  },

  removeExcerpt(memoryId: string, excerptId: string) {
    update((d) => {
      const m = d.memories.find((x) => x.id === memoryId);
      if (m?.transcript)
        m.transcript = m.transcript.filter((e) => e.id !== excerptId);
    });
  },

  cancelJob(jobId: string) {
    update((d) => {
      const job = d.jobs.find((j) => j.id === jobId);
      if (job && (job.status === "running" || job.status === "queued")) {
        job.status = "cancelled";
        job.error = "Cancelled. Any late result will be discarded.";
      }
    });
  },

  /**
   * Manual edits always create a new immutable revision. The original creation
   * provenance (template or AI) is kept, and AI lineage survives manual edits
   * ("Continue manually", FR-33).
   */
  savePlanRevision(
    plan: DesignPlan,
    origin: DesignPlan["origin"] = plan.origin,
  ) {
    const id = uid("plan");
    update((d) => {
      const latest = d.plans
        .filter((p) => p.collectionId === plan.collectionId)
        .reduce((max, p) => Math.max(max, p.revision), 0);
      const next: DesignPlan = {
        ...structuredClone(plan),
        id,
        revision: latest + 1,
        origin,
        parentRevision: plan.revision,
        aiLineage:
          plan.aiLineage ||
          plan.origin === "ai" ||
          plan.origin === "refinement",
        createdAt: now(),
        invalidatedReason: undefined,
      };
      d.plans.push(next);
      log(d, {
        collectionId: plan.collectionId,
        actorId: d.viewerId,
        kind: "plan.created",
        summary: `Saved design revision ${next.revision} (edited by hand from revision ${plan.revision})`,
        resource: `${id} r${next.revision}`,
      });
    });
    return id;
  },

  freezeCandidate(planId: string) {
    const id = uid("cand");
    update((d) => {
      const plan = d.plans.find((p) => p.id === planId);
      if (!plan || plan.invalidatedReason) return;
      for (const c of d.candidates)
        if (c.collectionId === plan.collectionId && c.status === "in-review") {
          c.status = "invalidated";
          c.invalidatedReason = "Replaced by a newer candidate";
        }
      const c = d.collections.find((x) => x.id === plan.collectionId)!;
      const approvers = finalApproverIds(d, plan);
      const seed = `${plan.id}:${plan.revision}:${now()}`;
      const editionId = `CH-ED-${fakeDigest(seed).slice(0, 4).toUpperCase()}-${String(d.candidates.filter((x) => x.collectionId === plan.collectionId).length + 1).padStart(2, "0")}`;
      d.candidates.push({
        id,
        collectionId: plan.collectionId,
        editionId,
        planId: plan.id,
        planRevision: plan.revision,
        pdfDigest: fakeDigest(seed + ":pdf"),
        manifestDigest: fakeDigest(seed + ":manifest"),
        sizeBytes: 4_000_000 + Math.round(Math.random() * 2_000_000),
        frozenAt: now(),
        frozenBy: d.viewerId,
        visibleIds: planVisibleIds(plan),
        styleOnlyIds: plan.styleOnlyIds,
        downloadMemberIds: [...c.memberIds],
        approvals: Object.fromEntries(
          approvers.map((a) => [a, "pending" as FinalDecision]),
        ),
        status: "in-review",
      });
      log(d, {
        collectionId: plan.collectionId,
        actorId: d.viewerId,
        kind: "candidate.frozen",
        summary: `Froze candidate ${editionId} from design revision ${plan.revision}`,
        resource: editionId,
      });
    });
    return id;
  },

  finalDecide(candidateId: string, decision: FinalDecision) {
    update((d) => {
      const c = d.candidates.find((x) => x.id === candidateId);
      if (!c || c.status !== "in-review" || !(d.viewerId in c.approvals))
        return;
      c.approvals[d.viewerId] = decision;
      log(d, {
        collectionId: c.collectionId,
        actorId: d.viewerId,
        kind: decision === "approved" ? "final.approved" : "final.declined",
        summary:
          decision === "approved"
            ? `Approved edition ${c.editionId}`
            : `Declined edition ${c.editionId}`,
        resource: c.editionId,
      });
    });
  },

  issueEdition(candidateId: string) {
    update((d) => {
      const c = d.candidates.find((x) => x.id === candidateId);
      if (!c || c.status !== "in-review") return;
      if (!Object.values(c.approvals).every((v) => v === "approved")) return;
      c.status = "issued";
      c.receipt = {
        id: `rcpt-${c.editionId.slice(6)}`,
        issuedAt: now(),
        pdfDigest: c.pdfDigest,
        manifestDigest: c.manifestDigest,
        approverCount: Object.keys(c.approvals).length,
        permissionRevision: d.permissionRevision,
        signature: `tide-sig:${fakeDigest(c.id).slice(0, 10)}…${fakeDigest(c.editionId).slice(0, 4)}`,
      };
      log(d, {
        collectionId: c.collectionId,
        actorId: "system",
        kind: "edition.issued",
        summary: `Issued edition ${c.editionId} with ${Object.keys(c.approvals).length} of ${Object.keys(c.approvals).length} approvals`,
        resource: c.editionId,
      });
    });
  },

  recordDownload(candidateId: string) {
    update((d) => {
      const c = d.candidates.find((x) => x.id === candidateId);
      if (!c) return;
      log(d, {
        collectionId: c.collectionId,
        actorId: d.viewerId,
        kind: "edition.downloaded",
        summary: `Downloaded edition ${c.editionId}`,
        resource: c.editionId,
      });
    });
  },
};

function buildPlanFromMemories(
  d: PrototypeState,
  collectionId: string,
  memories: Memory[],
  tokens: StyleTokens,
  revision: number,
  prompt?: string,
): DesignPlan {
  const visuals = memories.filter(
    (m) => m.art && (m.kind === "photo" || m.kind === "video"),
  );
  const texts = memories.filter((m) => m.kind === "text");
  const voices = memories.filter((m) => m.transcript && m.transcript.length);
  const collection = d.collections.find((c) => c.id === collectionId)!;
  const hero = visuals[0];
  const excerpts = voices.flatMap((v) =>
    (v.transcript ?? []).filter((e) => e.reviewed).map((e) => ({ v, e })),
  );
  let n = 0;
  const bid = () => `g-${revision}-${++n}`;
  const styleOnly = visuals.slice(3).map((m) => m.id);
  return {
    id: uid("plan"),
    collectionId,
    revision,
    origin: prompt ? "refinement" : "ai",
    createdAt: now(),
    prompt,
    inspiration: `${visuals.length} photos and stills, ${voices.length} transcript${voices.length === 1 ? "" : "s"}, and ${texts.length} stor${texts.length === 1 ? "y" : "ies"} suggested a ${tokens.name.toLowerCase()} direction${prompt ? `, adjusted for “${prompt}”` : ""}. Palette drawn from the dominant tones of the approved photos.`,
    styleOnlyIds: styleOnly,
    schemaVersion: "design-plan/0.1",
    tokens,
    pages: [
      {
        role: "cover",
        layout: "full",
        blocks: [
          {
            id: bid(),
            kind: "cover",
            memoryIds: hero ? [hero.id] : [],
            text: collection.title,
          },
        ],
      },
      {
        role: "opening",
        layout: "stack",
        blocks: [
          { id: bid(), kind: "heading", text: collection.occasion },
          ...(texts[0]
            ? [
                {
                  id: bid(),
                  kind: "note" as const,
                  memoryIds: [texts[0].id],
                  text: texts[0].story.slice(0, 220),
                  attributionId: texts[0].uploaderId,
                },
              ]
            : []),
        ],
      },
      {
        role: "photos",
        layout: "split",
        blocks: visuals.slice(0, 2).flatMap((m) => [
          { id: bid(), kind: "image" as const, memoryIds: [m.id] },
          {
            id: bid(),
            kind: "caption" as const,
            memoryIds: [m.id],
            text: m.caption,
            attributionId: m.uploaderId,
          },
        ]),
      },
      {
        role: "perspectives",
        layout: "stack",
        blocks: excerpts.slice(0, 3).map(({ v, e }) => ({
          id: bid(),
          kind: "quote" as const,
          memoryIds: [v.id],
          excerptId: e.id,
          text: e.text,
          attributionId: e.speakerId,
        })),
      },
      {
        role: "more",
        layout: "collage",
        blocks: [
          {
            id: bid(),
            kind: "collage",
            memoryIds: visuals.slice(0, 3).map((m) => m.id),
          },
        ],
      },
      {
        role: "closing",
        layout: "stack",
        blocks: [{ id: bid(), kind: "heading", text: "Until next time" }],
      },
    ],
  };
}

export function approversFor(memory: Memory) {
  return approverIds(memory);
}
