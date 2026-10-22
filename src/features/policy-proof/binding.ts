// This wire format is a contract input, not an authorization decision.
export type SourceBinding = {
  kind: "source";
  collectionId: string;
  resourceId: string;
  versionId: string;
  contentDigest: string;
  permissionRevision: string;
  requiredApprovers: string[];
  recipient: string;
  audience: string[];
  use:
    | { kind: "manual"; purpose: string }
    | {
        kind: "processor";
        role: "transcription" | "visual-analysis" | "design";
        purpose: string;
        derivativeType: string;
        inputDigest: string;
        transformationVersion: string;
        retention: string;
      };
};

export type EditionBinding = {
  kind: "edition";
  collectionId: string;
  candidateId: string;
  pdfDigest: string;
  manifestDigest: string;
  requiredApprovers: string[];
  recipient: string;
  audience: string[];
  sourceRevisions: {
    resourceId: string;
    versionId: string;
    permissionRevision: string;
  }[];
};

export type AuthorizationBinding = SourceBinding | EditionBinding;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a binding object.");
  return value as Record<string, unknown>;
}

function fields(value: Record<string, unknown>, names: string[]) {
  if (Object.keys(value).some((key) => !names.includes(key)))
    throw new Error("Unknown binding field.");
}

function text(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > 1024
  )
    throw new Error(
      "Binding fields must be nonempty, bounded strings without surrounding whitespace.",
    );
  return value;
}

function hash(value: unknown) {
  const result = text(value);
  if (!/^[a-f0-9]{64}$/.test(result))
    throw new Error("Expected a lowercase SHA-256 digest.");
  return result;
}

function identities(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64)
    throw new Error("Expected a nonempty identity set (at most 64).");
  const result = value.map(text).sort();
  if (new Set(result).size !== result.length)
    throw new Error("Duplicate identity.");
  return result;
}

export function parseBinding(input: unknown): AuthorizationBinding {
  const value = record(input);
  const common = {
    collectionId: text(value.collectionId),
    requiredApprovers: identities(value.requiredApprovers),
    recipient: text(value.recipient),
    audience: identities(value.audience),
  };
  const commonKeys = ["kind", ...Object.keys(common)];
  if (value.kind === "source") {
    fields(value, [
      ...commonKeys,
      "resourceId",
      "versionId",
      "contentDigest",
      "permissionRevision",
      "use",
    ]);
    const use = record(value.use);
    let scope: SourceBinding["use"];
    if (use.kind === "manual") {
      fields(use, ["kind", "purpose"]);
      scope = { kind: "manual", purpose: text(use.purpose) };
    } else if (use.kind === "processor") {
      fields(use, [
        "kind",
        "role",
        "purpose",
        "derivativeType",
        "inputDigest",
        "transformationVersion",
        "retention",
      ]);
      if (
        use.role !== "transcription" &&
        use.role !== "visual-analysis" &&
        use.role !== "design"
      )
        throw new Error("Unknown processor role.");
      scope = {
        kind: "processor",
        role: use.role,
        purpose: text(use.purpose),
        derivativeType: text(use.derivativeType),
        inputDigest: hash(use.inputDigest),
        transformationVersion: text(use.transformationVersion),
        retention: text(use.retention),
      };
    } else throw new Error("Unknown use scope.");
    return {
      kind: "source",
      ...common,
      resourceId: text(value.resourceId),
      versionId: text(value.versionId),
      contentDigest: hash(value.contentDigest),
      permissionRevision: text(value.permissionRevision),
      use: scope,
    };
  }
  if (value.kind === "edition") {
    fields(value, [
      ...commonKeys,
      "candidateId",
      "pdfDigest",
      "manifestDigest",
      "sourceRevisions",
    ]);
    if (
      !Array.isArray(value.sourceRevisions) ||
      value.sourceRevisions.length === 0 ||
      value.sourceRevisions.length > 64
    )
      throw new Error("Expected source revision dependencies (at most 64).");
    const sourceRevisions = value.sourceRevisions
      .map((entry) => {
        const revision = record(entry);
        fields(revision, ["resourceId", "versionId", "permissionRevision"]);
        return {
          resourceId: text(revision.resourceId),
          versionId: text(revision.versionId),
          permissionRevision: text(revision.permissionRevision),
        };
      })
      .sort((a, b) =>
        JSON.stringify(a) < JSON.stringify(b)
          ? -1
          : JSON.stringify(a) > JSON.stringify(b)
            ? 1
            : 0,
      );
    if (
      new Set(sourceRevisions.map((entry) => entry.resourceId)).size !==
      sourceRevisions.length
    )
      throw new Error("Duplicate source dependency.");
    return {
      kind: "edition",
      ...common,
      candidateId: text(value.candidateId),
      pdfDigest: hash(value.pdfDigest),
      manifestDigest: hash(value.manifestDigest),
      sourceRevisions,
    };
  }
  throw new Error("Unknown binding kind.");
}

export function bindingBytes(input: unknown): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    JSON.stringify({
      protocol: "chorus-policy-proof/v1",
      binding: parseBinding(input),
    }),
  );
}

export async function digest(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(result), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function bindingTag(input: unknown) {
  return `chorus-proof-v1:${await digest(bindingBytes(input))}`;
}
