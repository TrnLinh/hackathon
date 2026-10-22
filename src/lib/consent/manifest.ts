/** Versioned wire contract. These commitments describe data, never authorize release. */
export type RevisionReference = {
  authority: string;
  revision: string;
  evidenceId: string;
};
export type Influence = "visible" | "style" | "both";
export type SourceDependency = {
  versionId: string;
  contentDigest: string;
  permissionId: string;
  permissionDigest: string;
  revision: RevisionReference;
  influence: Influence;
  requiredApprovers: string[];
};
export type AcceptedText = {
  payloadId: string;
  digest: string;
  authorIds: string[];
  sourceVersionId?: string;
  startMs?: number;
  endMs?: number;
};
export type PlanOrigin =
  | { kind: "manual" }
  | { kind: "template"; templateId: string; templateVersion: string }
  | { kind: "ai"; jobId: string; modelVersion: string };
export type ProcessorProvenance = {
  jobId: string;
  modelVersion: string;
  configId: string;
  configRevision: number;
  recipient: string;
  role: "transcription" | "visual-analysis" | "design";
  purpose: string;
  derivativeType: string;
  transformationVersion: string;
  retention: string;
  inputCommitments: { permissionId: string; inputDigest: string }[];
};
export type DerivativeCommitment = {
  id: string;
  digest: string;
  sourceVersionId: string;
  transformationVersion: string;
  startMs: number;
  endMs: number;
  provenance: "local" | "processor";
  jobId?: string;
  priorDerivativeIds: string[];
};
export type EditionManifest = {
  protocol: "chorus-manifest/v1";
  collectionId: string;
  plan: {
    id: string;
    digest: string;
    schemaVersion: string;
    componentVersion: string;
    creationOrigin: PlanOrigin;
    revisionOrigin: PlanOrigin;
    parentId?: string;
  };
  rendererVersion: string;
  fontVersions: string[];
  sources: SourceDependency[];
  derivatives: DerivativeCommitment[];
  processors: ProcessorProvenance[];
  acceptedText: AcceptedText[];
  requiredApprovers: string[];
  recipient: string;
  reviewAudience: string[];
  downloadAudience: string[];
  distributionScope: string;
};

export function boundedText(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > 1024
  )
    throw new Error("Expected a nonempty bounded identifier.");
  return value;
}
export function parseSha256Hex(value: unknown): string {
  const result = boundedText(value);
  if (!/^[a-f0-9]{64}$/.test(result))
    throw new Error("Expected a lowercase SHA-256 digest.");
  return result;
}
export function stringSet(values: unknown, allowEmpty = false): string[] {
  if (
    !Array.isArray(values) ||
    values.length > 64 ||
    (!allowEmpty && values.length === 0)
  )
    throw new Error("Expected a bounded set.");
  const result = values.map(boundedText).sort();
  if (new Set(result).size !== result.length)
    throw new Error("Duplicate set member.");
  return result;
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error("Expected a plain object.");
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new Error("Unknown manifest field.");
  return value as Record<string, unknown>;
}
function list(value: unknown, limit = 64): unknown[] {
  if (!Array.isArray(value) || value.length > limit)
    throw new Error("Expected a bounded list.");
  return value;
}
export function parseRevision(value: unknown): RevisionReference {
  const r = object(value, ["authority", "revision", "evidenceId"]);
  return {
    authority: boundedText(r.authority),
    revision: boundedText(r.revision),
    evidenceId: boundedText(r.evidenceId),
  };
}
export function parseAcceptedText(value: unknown): AcceptedText {
  const t = object(value, [
    "payloadId",
    "digest",
    "authorIds",
    "sourceVersionId",
    "startMs",
    "endMs",
  ]);
  const result: AcceptedText = {
    payloadId: boundedText(t.payloadId),
    digest: parseSha256Hex(t.digest),
    authorIds: stringSet(t.authorIds),
  };
  if (t.sourceVersionId !== undefined)
    result.sourceVersionId = boundedText(t.sourceVersionId);
  if (t.startMs !== undefined || t.endMs !== undefined) {
    if (
      !result.sourceVersionId ||
      !Number.isSafeInteger(t.startMs) ||
      !Number.isSafeInteger(t.endMs) ||
      (t.startMs as number) < 0 ||
      (t.endMs as number) <= (t.startMs as number)
    )
      throw new Error("Invalid source time range.");
    result.startMs = t.startMs as number;
    result.endMs = t.endMs as number;
  }
  return result;
}
function parseSource(value: unknown): SourceDependency {
  const s = object(value, [
    "versionId",
    "contentDigest",
    "permissionId",
    "permissionDigest",
    "revision",
    "influence",
    "requiredApprovers",
  ]);
  if (
    s.influence !== "visible" &&
    s.influence !== "style" &&
    s.influence !== "both"
  )
    throw new Error("Invalid source influence.");
  return {
    versionId: boundedText(s.versionId),
    contentDigest: parseSha256Hex(s.contentDigest),
    permissionId: boundedText(s.permissionId),
    permissionDigest: parseSha256Hex(s.permissionDigest),
    revision: parseRevision(s.revision),
    influence: s.influence,
    requiredApprovers: stringSet(s.requiredApprovers),
  };
}

/** Sorted object keys; array order is significant. No undefined, nonfinite numbers or custom objects. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${Array.from(value, canonicalJson).join(",")}]`;
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const r = value as Record<string, unknown>;
    return `{${Object.keys(r)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(r[key])}`)
      .join(",")}}`;
  }
  throw new Error("Unsupported canonical JSON value.");
}
export async function commitment(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function parseOrigin(value: unknown): PlanOrigin {
  const o = object(value, [
    "kind",
    "templateId",
    "templateVersion",
    "jobId",
    "modelVersion",
  ]);
  if (o.kind === "manual" && Object.keys(o).length === 1)
    return { kind: "manual" };
  if (o.kind === "template" && Object.keys(o).length === 3)
    return {
      kind: "template",
      templateId: boundedText(o.templateId),
      templateVersion: boundedText(o.templateVersion),
    };
  if (o.kind === "ai" && Object.keys(o).length === 3)
    return {
      kind: "ai",
      jobId: boundedText(o.jobId),
      modelVersion: boundedText(o.modelVersion),
    };
  throw new Error("Invalid plan origin.");
}
function parseProcessor(value: unknown): ProcessorProvenance {
  const p = object(value, [
    "jobId",
    "modelVersion",
    "configId",
    "configRevision",
    "recipient",
    "role",
    "purpose",
    "derivativeType",
    "transformationVersion",
    "retention",
    "inputCommitments",
  ]);
  if (
    !Number.isSafeInteger(p.configRevision) ||
    (p.configRevision as number) <= 0
  )
    throw new Error("Invalid configuration revision.");
  if (
    p.role !== "transcription" &&
    p.role !== "visual-analysis" &&
    p.role !== "design"
  )
    throw new Error("Invalid processor role.");
  const inputCommitments = list(p.inputCommitments)
    .map((entry) => {
      const input = object(entry, ["permissionId", "inputDigest"]);
      return {
        permissionId: boundedText(input.permissionId),
        inputDigest: parseSha256Hex(input.inputDigest),
      };
    })
    .sort((a, b) => (a.permissionId < b.permissionId ? -1 : 1));
  if (
    !inputCommitments.length ||
    new Set(inputCommitments.map((i) => i.permissionId)).size !==
      inputCommitments.length
  )
    throw new Error("Invalid processor input set.");
  return {
    jobId: boundedText(p.jobId),
    modelVersion: boundedText(p.modelVersion),
    configId: boundedText(p.configId),
    configRevision: p.configRevision as number,
    recipient: boundedText(p.recipient),
    role: p.role,
    purpose: boundedText(p.purpose),
    derivativeType: boundedText(p.derivativeType),
    transformationVersion: boundedText(p.transformationVersion),
    retention: boundedText(p.retention),
    inputCommitments,
  };
}
function parseDerivative(value: unknown): DerivativeCommitment {
  const d = object(value, [
    "id",
    "digest",
    "sourceVersionId",
    "transformationVersion",
    "startMs",
    "endMs",
    "provenance",
    "jobId",
    "priorDerivativeIds",
  ]);
  if (
    (d.provenance !== "local" && d.provenance !== "processor") ||
    (d.provenance === "processor") !== (d.jobId !== undefined) ||
    !Number.isSafeInteger(d.startMs) ||
    !Number.isSafeInteger(d.endMs) ||
    (d.startMs as number) < 0 ||
    (d.endMs as number) <= (d.startMs as number)
  )
    throw new Error("Invalid derivative provenance or range.");
  return {
    id: boundedText(d.id),
    digest: parseSha256Hex(d.digest),
    sourceVersionId: boundedText(d.sourceVersionId),
    transformationVersion: boundedText(d.transformationVersion),
    startMs: d.startMs as number,
    endMs: d.endMs as number,
    provenance: d.provenance,
    ...(d.jobId !== undefined ? { jobId: boundedText(d.jobId) } : {}),
    priorDerivativeIds: stringSet(d.priorDerivativeIds, true),
  };
}

export function parseManifest(value: unknown): EditionManifest {
  const m = object(value, [
    "protocol",
    "collectionId",
    "plan",
    "rendererVersion",
    "fontVersions",
    "sources",
    "derivatives",
    "processors",
    "acceptedText",
    "requiredApprovers",
    "recipient",
    "reviewAudience",
    "downloadAudience",
    "distributionScope",
  ]);
  if (m.protocol !== "chorus-manifest/v1")
    throw new Error("Unknown manifest protocol.");
  const p = object(m.plan, [
    "id",
    "digest",
    "schemaVersion",
    "componentVersion",
    "creationOrigin",
    "revisionOrigin",
    "parentId",
  ]);
  const sources = list(m.sources)
    .map(parseSource)
    .sort((a, b) =>
      canonicalJson([a.versionId, a.permissionId]) <
      canonicalJson([b.versionId, b.permissionId])
        ? -1
        : 1,
    );
  if (
    new Set(sources.map((s) => canonicalJson([s.versionId, s.permissionId])))
      .size !== sources.length
  )
    throw new Error("Duplicate source permission dependency.");
  const derivatives = list(m.derivatives)
    .map(parseDerivative)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const processors = list(m.processors)
    .map(parseProcessor)
    .sort((a, b) => (a.jobId < b.jobId ? -1 : 1));
  if (new Set(processors.map((p) => p.jobId)).size !== processors.length)
    throw new Error("Duplicate processor job.");
  if (new Set(derivatives.map((d) => d.id)).size !== derivatives.length)
    throw new Error("Duplicate derivative.");
  const creationOrigin = parseOrigin(p.creationOrigin);
  const revisionOrigin = parseOrigin(p.revisionOrigin);
  const jobIds = new Set(processors.map((entry) => entry.jobId));
  const derivativeIds = new Set(derivatives.map((entry) => entry.id));
  for (const origin of [creationOrigin, revisionOrigin]) {
    if (
      origin.kind === "ai" &&
      !processors.some(
        (entry) =>
          entry.jobId === origin.jobId &&
          entry.modelVersion === origin.modelVersion &&
          entry.role === "design",
      )
    )
      throw new Error("Missing processor lineage for AI origin.");
  }
  for (const processor of processors) {
    for (const input of processor.inputCommitments) {
      if (!sources.some((source) => source.permissionId === input.permissionId))
        throw new Error("Missing processor lineage source.");
    }
  }
  for (const derivative of derivatives) {
    if (derivative.jobId && !jobIds.has(derivative.jobId))
      throw new Error("Missing processor lineage for derivative.");
    if (
      !sources.some(
        (source) => source.versionId === derivative.sourceVersionId,
      ) ||
      derivative.priorDerivativeIds.some(
        (id) => !derivativeIds.has(id) || id === derivative.id,
      )
    )
      throw new Error("Missing derivative ancestry.");
  }
  const versions = new Map<string, string>();
  for (const source of sources) {
    const value = canonicalJson([
      source.contentDigest,
      source.requiredApprovers,
    ]);
    if (
      versions.has(source.versionId) &&
      versions.get(source.versionId) !== value
    )
      throw new Error("Inconsistent source version.");
    versions.set(source.versionId, value);
  }
  const acceptedText = list(m.acceptedText, 128).map(parseAcceptedText);
  const requiredApprovers = stringSet(m.requiredApprovers);
  const expected = [
    ...new Set([
      ...sources.flatMap((s) => s.requiredApprovers),
      ...acceptedText.flatMap((t) => t.authorIds),
    ]),
  ].sort();
  if (canonicalJson(expected) !== canonicalJson(requiredApprovers))
    throw new Error(
      "Approvers must equal the full source and text-author union.",
    );
  for (const text of acceptedText) {
    if (
      text.sourceVersionId &&
      !sources.some((s) => s.versionId === text.sourceVersionId)
    )
      throw new Error("Text source is missing from dependency closure.");
  }
  return {
    protocol: m.protocol,
    collectionId: boundedText(m.collectionId),
    plan: {
      id: boundedText(p.id),
      digest: parseSha256Hex(p.digest),
      schemaVersion: boundedText(p.schemaVersion),
      componentVersion: boundedText(p.componentVersion),
      creationOrigin,
      revisionOrigin,
      ...(p.parentId !== undefined
        ? { parentId: boundedText(p.parentId) }
        : {}),
    },
    rendererVersion: boundedText(m.rendererVersion),
    fontVersions: stringSet(m.fontVersions),
    sources,
    derivatives,
    processors,
    acceptedText,
    requiredApprovers,
    recipient: boundedText(m.recipient),
    reviewAudience: stringSet(m.reviewAudience),
    downloadAudience: stringSet(m.downloadAudience),
    distributionScope: boundedText(m.distributionScope),
  };
}
export function manifestBytes(input: unknown): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(canonicalJson(parseManifest(input)));
}
export async function manifestDigest(input: unknown): Promise<string> {
  return commitment(parseManifest(input));
}

/**
 * Statement that a decision's evidence must commit to (`chorus-decision/v1`).
 * Binding the exact request, action, actor and revisions stops one person's
 * evidence from backing another person's decision, or a different action.
 */
export function decisionStatement(input: {
  requestDigest: string;
  action: "approve" | "decline" | "request-edit" | "withdraw";
  actor: string;
  revisions: unknown[];
}) {
  return commitment({
    protocol: "chorus-decision/v1",
    requestDigest: input.requestDigest,
    action: input.action,
    actor: input.actor,
    revisions: [
      ...new Set(input.revisions.map((r) => canonicalJson(r))),
    ].sort(),
  });
}
