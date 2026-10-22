# Public Convex API

The public functions in `convex/*.ts` (outside `convex/model/`) are the only client-callable surface. They wrap the internal CH-03 model (`docs/immutable-consent-model.md`).

## Rules every public function follows

- The actor comes from `ctx.auth` only (`convex/lib/viewer.ts`): the verified token's `tokenIdentifier` resolves the `users` row. No public function accepts a user ID for the caller.
- Each function authorizes the specific resource, then calls the internal model logic, which re-checks membership/operator status and keeps retry-receipt idempotency.
- Clients send one `retryKey` per intended change and reuse it only when retrying that same change (`useRetryKeys()` in `src/features/data/backend.tsx` keeps the key until the change succeeds).
- Errors are `ConvexError` codes; `describeError` maps them to user-facing copy.

## Identity registry

| Function              | Kind     | Notes                                                                                                                                               |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users.ensureCurrent` | mutation | No arguments. Creates or resolves the caller's `users` row from the verified token and refreshes `name` from the `name`/`preferred_username` claim. |
| `users.viewer`        | query    | The caller's `{ userId, name, isOperator }`, or `null` when signed out or not yet registered.                                                       |

The app shell mounts `EnsureCurrentUser` whenever sign-in is configured, so a signed-in person is registered before collection screens query. `users.name` is operator-visible routing metadata, like the subject and issuer.

## CH-22 AI availability

| Function                | Kind     | Notes                                                                                                                                                           |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiConfig.current`      | query    | Public, sanitized: `{ enabled, revision, changedAt }`. Missing configuration is off at revision 0.                                                              |
| `aiConfig.capabilities` | query    | `{ signedIn, isOperator, processorsConfigured }` for the caller. Never returns the processor configuration reference.                                           |
| `aiConfig.history`      | query    | Last 10 revisions for signed-in people. Who made a change is shown to operators only.                                                                           |
| `aiConfig.setEnabled`   | mutation | `{ enabled, expectedRevision, retryKey }`. Wraps `model/configuration.configure`: active operator only, compare-and-set revision, receipt-based retry recovery. |

Enabling requires the Convex environment variable `CHORUS_PROCESSOR_CONFIG_REF`, an opaque reference to the CH-21 processor roles (never a credential). Without it `capabilities.processorsConfigured` is false and enabling fails with `PROCESSOR_CONFIG_REQUIRED`. The enabled revision records that reference; if the deployment later stops providing it (unset or changed), `aiConfig.current` and the job admission, dispatch and completion checks all read AI as off until an operator enables it again.

```bash
npx convex env set CHORUS_PROCESSOR_CONFIG_REF team-inference-v1
```

Disabling does not yet sweep job projections to `invalidated`: no public job API or dispatcher exists. The model already refuses to mark a job `running` or `complete`, or accept its result, once the configuration it was admitted under is disabled or superseded. The sweep lands with the CH-18/19/21 dispatcher.

### Operator provisioning

Operators are provisioned through internal mutations, so only a holder of the deployment admin key can run them. The person must have signed in once so their registry row exists. Each change appends an `operatorChanges` row.

```bash
npx convex run model/operators:grant '{"tokenIdentifier":"https://id.example/realms/chorus|<subject>"}'
npx convex run model/operators:revoke '{"tokenIdentifier":"https://id.example/realms/chorus|<subject>"}'
```

Collection ownership never makes someone an operator, and operator status grants no contributor consent.

## CH-04 collections and membership

| Function                  | Kind     | Notes                                                                                                                                                  |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `collections.create`      | mutation | `{ encryptedMetadata, retryKey }`. The caller becomes creator. Retries with the same key return the same collection (`collectionReceipts`).            |
| `collections.listMine`    | query    | Active collections (with members and, for the creator, pending count) plus the caller's own pending requests, which show only the creator's name.      |
| `collections.get`         | query    | `{ collectionId: string }`. `access: "member"` with metadata and members; `"requested"`; or `"none"` for non-members, unknown and malformed IDs alike. |
| `memberships.preview`     | query    | `{ joinCode }` for signed-in people: creator name, member count and the caller's own status. Never the encrypted title.                                |
| `memberships.requests`    | query    | Pending join requests, creator only.                                                                                                                   |
| `memberships.requestJoin` | mutation | `{ joinCode, retryKey }`. Creates or re-opens a `requested` membership. Grants nothing until admitted.                                                 |
| `memberships.admit`       | mutation | Creator only. `requested` → `active`.                                                                                                                  |
| `memberships.decline`     | mutation | Creator only. `requested` → `declined`. The person may ask again.                                                                                      |
| `memberships.remove`      | mutation | Creator only. `active` → `removed`. Approved audiences, decisions and files already received are unchanged.                                            |

Membership statuses are `requested`, `active`, `declined` and `removed`. `admittedAt` records the first admission. Only someone admitted at some point keeps former-member rights (recording evidence, withdrawing), so a declined or never-admitted requester has none. Every membership change goes through `recordMutation`: retry receipt, membership check, write, audit event.

Asking to join again while a request is pending, or while already a member, writes nothing. A removed member keeps evidence and withdraw rights in the model, but `collections.get` and `listMine` no longer show them the collection; CH-08 must give former members a screen to withdraw from.

Signing in from a gated page (for example a join link) returns to that page: the path is kept in `sessionStorage` and only same-origin `/app` paths are accepted (`src/features/auth/return-path.ts`).

Join codes are eight characters from an unambiguous alphabet (`XXXX-XXXX`, case-insensitive). They are routing metadata that operators can see; admission by the creator is the control.

### Interim dev envelope (documented exception)

The SRD forbids plaintext private metadata remotely, and the CH-02 envelope does not exist yet. As an explicit, temporary exception, collection metadata may use `chorus-dev-envelope/v0` (`src/lib/consent/dev-envelope.ts`). **It is not encryption**: it is base64 of UTF-8 JSON, readable by anyone with database access.

- The backend rejects it with `DEV_ENVELOPE_DISABLED` unless the deployment sets `npx convex env set CHORUS_ALLOW_DEV_ENVELOPE 1`. The default is off. Only enable it on disposable development deployments with synthetic content.
- Any other format fails with `UNSUPPORTED_ENVELOPE`; the server never decodes the envelope.
- The UI labels such collections "Not encrypted (dev)".
- When CH-02 lands, replace the format, stop setting the flag, and discard dev-envelope data: it was never protected.

### Transition from the prototype store

Collections, Members and Join use Convex and require sign-in. Prototype seed collections stay listed under "Prototype demo collections" so screens not yet switched (memories, compose, edition, history) remain explorable; those child routes are wrapped in `PrototypeOnly` and show a notice for Convex collections.

## CH-05 memories

| Function                     | Kind     | Notes                                                                                                                                                                      |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `memories.generateUploadUrl` | mutation | Active members only. A single-use Convex storage upload URL.                                                                                                               |
| `memories.create`            | mutation | `{ collectionId, kind, content, media?, requiredApproverIds, retryKey }`. Creates the memory and its first version in one transaction. The uploader is always an approver. |
| `memories.revise`            | mutation | Uploader only. `{ memoryId, priorVersionId, content, media?, requiredApproverIds, retryKey }`. Compare-and-set on the head; omitting `media` keeps the current bytes.      |
| `memories.list`              | query    | Memories in a collection the caller may see.                                                                                                                               |
| `memories.get`               | query    | One memory with its version history, newest first. `null` for anything the caller may not see, including malformed IDs.                                                    |
| `memories.mediaUrl`          | query    | A storage URL for a version's media, for permitted viewers only; `null` otherwise.                                                                                         |

In this slice every version is a **private draft visible only to its uploader** (and only while an active member). CH-06 adds submission, review grants for required approvers and permission requests; CH-07 the inbox.

- `content.envelope` holds `chorus-memory/v1` (`src/lib/memory-content.ts`): kind, title, caption, story and, for media, the SHA-256, type, size and dimensions/duration of the retained bytes. `contentDigest` is the canonical commitment of that object, so a version commits to its exact media.
- Each change is one Convex transaction: content payload, version (`appendVersion`), media payload and `mediaAssets` row. Internal retry keys derive from the client's key, so a retry after a lost response returns the committed IDs; reusing a key for different input fails.
- Uploads: the server checks the stored blob's size against the declared size and the per-type limit, the type against the allowlist, and records the blob's SHA-256 from storage (not from the client). Each blob can back only one payload (`uploadClaims`).
- Limits: twelve memories with a current version per collection, and the collection byte budget over current versions' media (`src/lib/limits.ts`, shared with the browser).

Browser preparation (`src/features/data/memories.ts`): file type comes from the bytes (`validate-media.ts`); images are re-encoded through a canvas, which applies EXIF orientation and drops EXIF/GPS and other metadata, before hashing and upload.

**Known gaps (dev envelope exception applies):**

- Content and media bytes are stored unencrypted (`chorus-dev-envelope/v0`); the UI labels drafts "Not encrypted (dev)".
- Audio and video container metadata (for example MP4 location atoms) is not stripped yet.
- `mediaUrl` returns a bearer URL: anyone holding it can fetch the bytes until storage is deleted. Real protected playback needs CH-02 decryption.
- Uploaded blobs that never become a payload are not garbage-collected yet.
- Video stills and typed excerpts use `appendArtifact`, which requires approved permissions; they move to Convex after CH-07.
