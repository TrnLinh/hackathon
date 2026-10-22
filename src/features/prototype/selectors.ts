import type {
  Candidate,
  DesignPlan,
  Memory,
  MemoryStatus,
  Person,
  PersonId,
  PrototypeState,
} from "./types";

export function personById(state: PrototypeState, id: PersonId): Person {
  return (
    state.people.find((p) => p.id === id) ?? {
      id,
      name: "Unknown member",
      hue: 0,
    }
  );
}

export function firstName(person: Person) {
  return person.name.split(" ")[0];
}

/** Every declared person, including the uploader, must decide. */
export function approverIds(memory: Memory): PersonId[] {
  return Array.from(new Set([memory.uploaderId, ...memory.peopleIds]));
}

export function manualEligible(memory: Memory) {
  return (
    memory.submitted &&
    approverIds(memory).every(
      (id) => memory.decisions[id]?.manual === "approved",
    )
  );
}

/** AI may use a source only when every approver granted every requested processor. */
export function aiEligible(memory: Memory) {
  return (
    manualEligible(memory) &&
    approverIds(memory).every((id) =>
      memory.requestedProcessors.every(
        (proc) => memory.decisions[id]?.processors[proc] === "approved",
      ),
    )
  );
}

/**
 * Manual approval alone makes a memory usable in templates and manual editing.
 * AI processing is a separate, optional permission (FR-15, CH-07).
 */
export function memoryStatus(memory: Memory): MemoryStatus {
  if (!memory.submitted) return "private";
  const manual = approverIds(memory).map(
    (id) => memory.decisions[id]?.manual ?? "pending",
  );
  if (manual.some((d) => d === "declined" || d === "withdrawn"))
    return "excluded";
  if (manual.some((d) => d === "pending")) return "awaiting";
  return aiEligible(memory) ? "available" : "manual-only";
}

/** Approvers who still owe the required manual-use decision. AI is optional. */
export function pendingApproverIds(memory: Memory): PersonId[] {
  return approverIds(memory).filter((id) => {
    const d = memory.decisions[id];
    return !d || d.manual === "pending";
  });
}

/** Approvers who have not decided on every requested AI processor yet. */
export function pendingAiApproverIds(memory: Memory): PersonId[] {
  return approverIds(memory).filter((id) =>
    memory.requestedProcessors.some(
      (proc) =>
        (memory.decisions[id]?.processors[proc] ?? "pending") === "pending",
    ),
  );
}

export function inboxFor(state: PrototypeState, viewerId: PersonId) {
  return state.memories.filter(
    (m) =>
      m.submitted &&
      approverIds(m).includes(viewerId) &&
      pendingApproverIds(m).includes(viewerId),
  );
}

export function collectionMemories(
  state: PrototypeState,
  collectionId: string,
) {
  return state.memories.filter((m) => m.collectionId === collectionId);
}

/** Memories visible on any page of the plan. */
export function planVisibleIds(plan: DesignPlan): string[] {
  return Array.from(
    new Set(
      plan.pages.flatMap((p) => p.blocks.flatMap((b) => b.memoryIds ?? [])),
    ),
  );
}

/** Full influence closure: visible plus style-only sources. */
export function planInfluenceIds(plan: DesignPlan): string[] {
  return Array.from(new Set([...planVisibleIds(plan), ...plan.styleOnlyIds]));
}

/**
 * Final approvers: everyone declared on a visible or style-influencing source,
 * plus authors of new attributed text.
 */
export function finalApproverIds(
  state: PrototypeState,
  plan: DesignPlan,
): PersonId[] {
  const ids = new Set<PersonId>();
  for (const memoryId of planInfluenceIds(plan)) {
    const memory = state.memories.find((m) => m.id === memoryId);
    if (memory) approverIds(memory).forEach((id) => ids.add(id));
  }
  for (const page of plan.pages)
    for (const block of page.blocks)
      if (block.edited && block.attributionId) ids.add(block.attributionId);
  return Array.from(ids);
}

export function latestPlan(state: PrototypeState, collectionId: string) {
  return state.plans
    .filter((p) => p.collectionId === collectionId)
    .sort((a, b) => b.revision - a.revision)[0];
}

export function activeCandidate(state: PrototypeState, collectionId: string) {
  return state.candidates
    .filter(
      (c) => c.collectionId === collectionId && c.status !== "invalidated",
    )
    .sort((a, b) => b.frozenAt.localeCompare(a.frozenAt))[0];
}

export function candidateProgress(candidate: Candidate) {
  const values = Object.values(candidate.approvals);
  return {
    approved: values.filter((v) => v === "approved").length,
    declined: values.filter((v) => v === "declined").length,
    total: values.length,
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function shortDigest(digest: string) {
  return `${digest.slice(0, 8)}…${digest.slice(-6)}`;
}

/** SRD budgets used by validation and budget meters. */
export { LIMITS } from "@/lib/limits";
