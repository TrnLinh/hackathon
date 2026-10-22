// UI prototype domain model. Mirrors the SRD vocabulary so screens can later be
// wired to Convex and Tide-protected operations without renaming concepts.
// Nothing here enforces consent; it only drives the interface.

export type PersonId = string;
export type CollectionId = string;
export type MemoryId = string;

export type Person = {
  id: PersonId;
  name: string;
  /** Hue used for the avatar background. Never the only status signal. */
  hue: number;
};

export type MemoryKind = "photo" | "voice" | "video" | "text";

/** Synthetic placeholder art for a photo, still, or video poster. */
export type Artwork = {
  /** Two CSS colors for the gradient. */
  from: string;
  to: string;
  /** Short scene label rendered on the placeholder, e.g. "Sunset pier". */
  scene: string;
};

export type MediaInfo = {
  mime: string;
  codec?: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  /** Local preparation applied before encryption (EXIF removal, orientation). */
  sanitized: boolean;
};

export type TranscriptExcerpt = {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  /** Declared speaker; never inferred automatically. */
  speakerId: PersonId;
  reviewed: boolean;
};

export type VideoStill = {
  id: string;
  atSec: number;
  art: Artwork;
  selected: boolean;
};

/** One state per decision. "pending" means silence, which never counts as consent. */
export type Decision = "pending" | "approved" | "declined" | "withdrawn";

export type ProcessorId = "transcriber" | "vision" | "designer";

export type Processor = {
  id: ProcessorId;
  name: string;
  role: string;
  /** Derivative types the processor may receive under a grant. */
  receives: string[];
  retention: string;
  model: string;
  runtime: string;
  endpoint: string;
  health: "online" | "degraded" | "offline";
  /** Applicable media kinds. */
  appliesTo: MemoryKind[];
};

export type ApproverDecisions = {
  /** Manual editor and private review audience use. */
  manual: Decision;
  /** Separate optional permission per disclosed processor. */
  processors: Partial<Record<ProcessorId, Decision>>;
  decidedAt?: string;
  /** Request-edit flag; the explanation stays private to the uploader. */
  editRequested?: boolean;
};

export type MemoryVersion = {
  version: number;
  createdAt: string;
  note: string;
};

export type Memory = {
  id: MemoryId;
  collectionId: CollectionId;
  kind: MemoryKind;
  title: string;
  caption: string;
  story: string;
  uploaderId: PersonId;
  /** Declared people including speakers. Always contains the uploader. */
  peopleIds: PersonId[];
  version: number;
  versions: MemoryVersion[];
  createdAt: string;
  /** Draft memories have not been submitted for approval yet. */
  submitted: boolean;
  art?: Artwork;
  media?: MediaInfo;
  transcript?: TranscriptExcerpt[];
  stills?: VideoStill[];
  /** Processors this memory's request discloses. */
  requestedProcessors: ProcessorId[];
  decisions: Record<PersonId, ApproverDecisions>;
};

/**
 * Derived consent status shown to members. Matches CH-07 vocabulary:
 * private (draft), awaiting permission, available, excluded.
 * "manual-only" is available for manual composition but excluded from AI.
 */
export type MemoryStatus =
  "private" | "awaiting" | "available" | "manual-only" | "excluded";

export type Collection = {
  id: CollectionId;
  title: string;
  occasion: string;
  creatorId: PersonId;
  memberIds: PersonId[];
  /** People who opened the join link and await the creator's admission. */
  pendingIds: PersonId[];
  joinCode: string;
  createdAt: string;
};

export type BlockKind =
  | "cover"
  | "heading"
  | "image"
  | "grid"
  | "collage"
  | "quote"
  | "caption"
  | "note";

export type Block = {
  id: string;
  kind: BlockKind;
  /** Visible source memories this block draws from. */
  memoryIds?: MemoryId[];
  /** For video stills. */
  stillIds?: string[];
  text?: string;
  attributionId?: PersonId;
  /** Transcript provenance for quotes. */
  excerptId?: string;
  /** New text written by the editor, marked for final review. */
  edited?: boolean;
};

export type PageRole =
  "cover" | "opening" | "photos" | "perspectives" | "more" | "closing";

export type Page = {
  role: PageRole;
  layout: "full" | "split" | "grid" | "collage" | "stack";
  blocks: Block[];
};

export type StyleTokens = {
  name: string;
  paper: string;
  ink: string;
  accent: string;
  muted: string;
  headingFont: "serif" | "hand" | "grotesk" | "mono";
  bodyFont: "serif" | "sans";
  texture: "film" | "tape" | "none" | "grain";
};

export type PlanOrigin = "ai" | "manual" | "refinement";

export type DesignPlan = {
  id: string;
  collectionId: CollectionId;
  revision: number;
  origin: PlanOrigin;
  createdAt: string;
  prompt?: string;
  inspiration: string;
  /** Memory ids used for style only, without appearing on a page. */
  styleOnlyIds: MemoryId[];
  tokens: StyleTokens;
  pages: Page[];
  schemaVersion: string;
  /** Set when a withdrawal or source change invalidates this plan. */
  invalidatedReason?: string;
};

export type JobStatus =
  "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type ProcessingJob = {
  id: string;
  collectionId: CollectionId;
  processorId: ProcessorId;
  label: string;
  status: JobStatus;
  createdAt: string;
  memoryIds: MemoryId[];
  error?: string;
};

export type FinalDecision = "pending" | "approved" | "declined";

export type Candidate = {
  id: string;
  collectionId: CollectionId;
  editionId: string;
  planId: string;
  planRevision: number;
  /** SHA-256 of the exact frozen PDF bytes (synthetic in the prototype). */
  pdfDigest: string;
  manifestDigest: string;
  sizeBytes: number;
  frozenAt: string;
  frozenBy: PersonId;
  visibleIds: MemoryId[];
  styleOnlyIds: MemoryId[];
  downloadMemberIds: PersonId[];
  approvals: Record<PersonId, FinalDecision>;
  status: "in-review" | "issued" | "invalidated";
  invalidatedReason?: string;
  receipt?: Receipt;
};

export type Receipt = {
  id: string;
  issuedAt: string;
  pdfDigest: string;
  manifestDigest: string;
  approverCount: number;
  permissionRevision: number;
  signature: string;
};

export type HistoryKind =
  | "collection.created"
  | "member.joined"
  | "member.admitted"
  | "member.removed"
  | "memory.added"
  | "memory.revised"
  | "decision.approved"
  | "decision.declined"
  | "decision.withdrawn"
  | "decision.edit-requested"
  | "job.dispatched"
  | "job.finished"
  | "job.failed"
  | "plan.created"
  | "plan.invalidated"
  | "candidate.frozen"
  | "candidate.invalidated"
  | "final.approved"
  | "final.declined"
  | "edition.issued"
  | "edition.downloaded";

export type HistoryEvent = {
  id: string;
  collectionId: CollectionId;
  at: string;
  actorId: PersonId | "system";
  kind: HistoryKind;
  /** Human-readable, never containing source plaintext. */
  summary: string;
  resource?: string;
};

export type PrototypeState = {
  viewerId: PersonId;
  people: Person[];
  processors: Processor[];
  collections: Collection[];
  memories: Memory[];
  plans: DesignPlan[];
  jobs: ProcessingJob[];
  candidates: Candidate[];
  history: HistoryEvent[];
  /** Permission revision counter, bumped on every decision change. */
  permissionRevision: number;
};
