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
  "This backlog breaks the remaining photozine MVP into eighteen implementation issues and one tracking issue. The Next.js, Convex, shadcn/ui, and TanStack Router starter is already complete; it is not counted as new work.",
  "The [product specification](chorus-product-spec.md) defines the experience and the [SRD](chorus-srd.md) defines the requirements. The issue definitions in [backlog/issues.json](backlog/issues.json) are the publication source.",
  "## Delivery order",
  "Start with CH-01 and CH-02 to prove real identity, protected sharing, revocation semantics, and signing feasibility. Then build the collection and consent flow, the photozine and final edition flow, and the demonstration. Frontend drafts may be developed against agreed interfaces, but simulated policies do not complete the security gates.",
  "P0 identifies consent and integration gates. P1 completes the required product. P2 is optional. Follow the dependency graph; a P0 ticket can depend on a P1 product capability. No owner or deadline has been assumed.",
  "## Issue index",
  "| ID | Priority | Milestone | Issue | Depends on |",
  "| --- | --- | --- | --- | --- |",
  ...backlog.issues.map(
    (issue) =>
      `| [${issue.id}](#${issue.id.toLowerCase()}) | ${issue.priority} | ${issue.milestone} | ${issue.title} | ${issue.dependsOn.join(", ") || "None"} |`,
  ),
  "## Publication",
  "The Publish Chorus backlog workflow creates missing GitHub issues, labels, milestones, an MVP checklist, and links between dependencies. It runs when the manifest is pushed to main and can also be started manually in Actions. It uses GitHub's repository-scoped workflow token with contents read and issues write permissions; no personal token is required.",
  "Publication is idempotent: stable markers identify issues across retries, including a response lost after creation. Existing issue bodies, completion checkboxes, and closed states are preserved. After a partial run, rerun the workflow. Duplicate existing markers cause publication to stop for reconciliation. Each successful run produces a public summary and an artifact mapping ticket IDs to issue URLs.",
  "Update the JSON source and run npm run backlog:docs to regenerate this file. Re-running publication creates missing issues and preserves existing issue text; edit an already published issue explicitly when its requirements change.",
  "## Completion criteria",
  "The MVP is complete when every MUST requirement is implemented and the applicable SRD acceptance tests have evidence. CH-18 is optional; the manual composition path must work without it. Authorized reviewers and downloaders can copy material they already received, so the product cannot promise recall or DRM.",
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
