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
  `This backlog defines ${backlog.issues.length} implementation tickets and one tracker for template and optional-at-runtime AI photozine creation. Product/SRD version 0.3 gives both paths a shared DesignPlan/editor/renderer and adds a backend AI switch. Existing tickets keep their IDs; CH-01 scope is unchanged.`,
  "The [product specification](chorus-product-spec.md) defines the experience and the [SRD](chorus-srd.md) defines the requirements. The issue definitions in [backlog/issues.json](backlog/issues.json) are the publication source.",
  "## Delivery order",
  "Complete remaining CH-01 live identity evidence and CH-02 protected sharing/revocation/signing gates. CH-20 contract work and CH-21 optional inference can use synthetic fixtures independently. After CH-03, CH-22 runtime availability can proceed beside collection/upload work. No core template/export ticket depends on CH-18, CH-19, or CH-21. Simulated source policies do not complete the security gates.",
  "P0 identifies consent and integration gates. P1 completes the required product. P2 is optional. Follow the dependency graph; a P0 ticket can depend on a P1 product capability. No owner or deadline has been assumed.",
  "## Parallel work groups",
  "1. Independently: CH-20 shared plan contract and CH-21 optional inference setup use synthetic fixtures alongside remaining CH-01 live verification.\n2. After CH-02 → CH-03: CH-04 collections and CH-22 runtime AI switch can run in parallel; continue CH-05 local multimedia preparation → CH-06 source permissions → CH-07 inbox.\n3. After CH-07: CH-08 withdrawals and CH-09 Template mode run in parallel once CH-20/CH-22 are ready.\n4. Core delivery: CH-09 → CH-10 shared PDF freeze → CH-11 final review → CH-12 receipts → CH-13 download; CH-11 also requires CH-08. No model is required.\n5. AI lane: CH-19 consented processing starts after CH-08/CH-21/CH-22; CH-18 adds live generation/refinement after CH-19 and CH-10, and can overlap final-consent/download work.\n6. After CH-13: CH-14 history/recovery and CH-15 polish run in parallel → CH-16 core verification → CH-17 template/off-state demo. Enabled-AI evidence from CH-18/CH-19/CH-21 is required separately for full dual-mode signoff.",
  "## Issue index",
  "| ID | Priority | Milestone | Issue | Depends on |",
  "| --- | --- | --- | --- | --- |",
  ...backlog.issues.map(
    (issue) =>
      `| [${issue.id}](#${issue.id.toLowerCase()}) | ${issue.priority} | ${issue.milestone} | ${issue.title} | ${issue.dependsOn.join(", ") || "None"} |`,
  ),
  "## Publication",
  "The Publish Chorus backlog workflow creates missing GitHub issues, labels, milestones, an MVP checklist, and links between dependencies. It runs when the manifest is pushed to main and can also be started manually in Actions. It uses GitHub's repository-scoped workflow token with contents read and issues write permissions; no personal token is required.",
  "Publication is idempotent: stable markers identify issues across retries, including a response lost after creation or update. Existing issues are revised only when named by an explicit manifest revision. The current scope is first; the complete prior description/notes remain historical quoted Markdown, with unchanged checked criteria carried forward. Comments, state, assignments, and custom labels are retained. CH-01 is excluded from dual-creation-modes-v1 targets. Duplicate markers stop publication for reconciliation. The workflow summary/artifact lists created/revised tickets and URLs.",
  "Update the JSON source and run npm run backlog:docs to regenerate this file. To revise already published scope, add a new unique revision ID and an explicit target list; a revision runs once per issue. Re-running the same revision preserves later human edits and does not append duplicates. Do not reuse a published revision ID for a further scope change.",
  "## Completion criteria",
  "The template milestone completes the full consent-to-approved-PDF flow with AI off and no model credentials/service. The full dual-mode release additionally verifies implemented enabled-AI generation/transcription/refinement and all applicable AT-01 through AT-26 evidence. AI is optional per zine and in runtime configuration; disabling an implemented feature does not make its earlier evidence disappear. CH-22 covers all AI dispatch, queues, and retries. Switching modes preserves source/AI lineage and does not change existing frozen bytes. Authorized recipients can copy plaintext already released; no recall or DRM is promised.",
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
