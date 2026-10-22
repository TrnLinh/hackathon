import { readFile, writeFile } from "node:fs/promises";
import { validateBacklog } from "./publish-backlog.mjs";

const backlog = JSON.parse(
  await readFile(
    new URL("../docs/backlog/issues.json", import.meta.url),
    "utf8",
  ),
);
validateBacklog(backlog);
const lines = [
  "# Chorus Implementation Backlog",
  `This backlog breaks the multimedia, AI-designed photozine MVP into ${backlog.issues.length} implementation issues and one tracking issue. The Next.js, Convex, shadcn/ui, and TanStack Router starter is already complete; it is not counted as new work. Product/SRD version 0.2.1 keeps multimedia AI design core and sets self-hosted team-cloud inference as the demo target.`,
  "The [product specification](chorus-product-spec.md) defines the experience and the [SRD](chorus-srd.md) defines the requirements. The issue definitions in [backlog/issues.json](backlog/issues.json) are the publication source.",
  "## Delivery order",
  "CH-01 is underway and its authentication scope is unchanged. Continue with CH-02 to prove real identity, scoped sharing (including processors), revocation, and signing feasibility. CH-20 design contracts and CH-21 self-hosted inference can start now using synthetic fixtures without depending on authentication. Frontend drafts may use agreed interfaces, but simulated policies do not complete the security gates.",
  "P0 identifies consent and integration gates. P1 completes the required product. P2 is optional. Follow the dependency graph; a P0 ticket can depend on a P1 product capability. No owner or deadline has been assumed.",
  "## Parallel work groups",
  "1. Now: continue CH-01 authentication while CH-20 defines the design contract and CH-21 establishes self-hosted inference using synthetic fixtures. Neither edits authentication.\n2. Protected foundation: CH-02 → CH-03 → CH-04 → CH-05 → CH-06 → CH-07, respecting all listed dependencies.\n3. After CH-07: CH-08 withdrawals and CH-09 composer can run in parallel if CH-20 is ready.\n4. After CH-08: CH-19 media derivatives → CH-18 real AI art direction, each integrating CH-21 endpoints once ready. This chain can overlap CH-09; CH-18 does not depend on the composer. Agree processor adapters early.\n5. Once CH-09 and CH-18 are ready: CH-10 integrated PDF freeze → CH-11 final review → CH-12 receipt → CH-13 download.\n6. After CH-13: CH-14 history/recovery and CH-15 polish run in parallel → CH-16 verification → CH-17 demonstration.",
  "## Issue index",
  "| ID | Priority | Milestone | Issue | Depends on |",
  "| --- | --- | --- | --- | --- |",
  ...backlog.issues.map(
    (issue) =>
      `| [${issue.id}](#${issue.id.toLowerCase()}) | ${issue.priority} | ${issue.milestone} | ${issue.title} | ${issue.dependsOn.join(", ") || "None"} |`,
  ),
  "## Publication",
  "The Publish Chorus backlog workflow creates missing GitHub issues, labels, milestones, an MVP checklist, and links between dependencies. It runs when the manifest is pushed to main and can also be started manually in Actions. It uses GitHub's repository-scoped workflow token with contents read and issues write permissions; no personal token is required.",
  "Publication is idempotent: stable markers identify issues across retries, including a response lost after creation or update. Existing issues are revised only when named by an explicit manifest revision. The current scope is placed first; the complete prior description and implementation notes remain in a historical details block as quoted Markdown, so old checklists are not active tasks. Exact unchanged checked criteria are carried forward. Comments, state, assignments, and custom labels are retained. CH-01 is excluded from scope revision targets; the self-hosted-demo-v1 revision changes only the tracker and CH-16, CH-17, CH-18, and CH-19. Duplicate markers stop publication for reconciliation. The workflow summary/artifact lists created and revised tickets and their URLs.",
  "Update the JSON source and run npm run backlog:docs to regenerate this file. To revise already published scope, add a new unique revision ID and an explicit target list; a revision runs once per issue. Re-running the same revision preserves later human edits and does not append duplicates. Do not reuse a published revision ID for a further scope change.",
  "## Completion criteria",
  "The MVP is complete when every MUST requirement is implemented and AT-01 through AT-22 have applicable evidence. CH-18 is required AI-inferred design, CH-19 handles authorized multimedia derivatives, CH-20 supplies the safe plan contract, and CH-21 proves authenticated self-hosted cloud inference. A complete manual path remains required for decline/outage recovery; manual-only does not complete the AI requirement. Style-only influencing sources retain consent dependencies. Authorized processors/reviewers/downloaders can copy plaintext already received; the product cannot promise recall or DRM.",
];
for (const issue of backlog.issues) {
  lines.push(
    `## ${issue.id}`,
    `**${issue.title}**`,
    `Priority ${issue.priority} · ${issue.milestone} · Dependencies: ${issue.dependsOn.join(", ") || "none"}.`,
    issue.goal,
    "### Scope",
    issue.scope.map((item) => `- ${item}`).join("\n"),
    "### Acceptance criteria",
    issue.acceptance.map((item) => `- [ ] ${item}`).join("\n"),
    `Requirements: ${issue.requirements.join(", ")}. Acceptance tests: ${issue.tests.join(", ") || "demonstration and documentation review"}.`,
    issue.notes,
  );
}
await writeFile(
  new URL("../docs/backlog.md", import.meta.url),
  `${lines.join("\n\n")}\n`,
);
console.log("Rendered docs/backlog.md from the issue manifest.");
