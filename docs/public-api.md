# Public Convex API

The public functions in `convex/*.ts` (outside `convex/model/`) are the only client-callable surface. They wrap the internal CH-03 model (`docs/immutable-consent-model.md`).

## Rules every public function follows

- The actor comes from `ctx.auth` only (`convex/lib/viewer.ts`): the verified token's `tokenIdentifier` resolves the `users` row. No public function accepts a user ID for the caller.
- Each function authorizes the specific resource, then calls the internal model logic, which re-checks membership/operator status and keeps retry-receipt idempotency.
- Clients send one `retryKey` per intended change (`newRetryKey()` in `src/features/data/backend.tsx`) and reuse it only when retrying that same change.
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

Enabling requires the Convex environment variable `CHORUS_PROCESSOR_CONFIG_REF`, an opaque reference to the CH-21 processor roles (never a credential). Without it `capabilities.processorsConfigured` is false and enabling fails with `PROCESSOR_CONFIG_REQUIRED`.

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
