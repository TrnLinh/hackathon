import { readFile } from "node:fs/promises";

const markerFor = (id) => `<!-- chorus-backlog:v1:${id} -->`;
const trackerDraft = "<!-- chorus-backlog:tracker-draft -->";
const revisionMarker = (backlog) =>
  backlog.revision && `<!-- chorus-backlog:revision:${backlog.revision.id} -->`;

export function validateBacklog(backlog) {
  if (backlog.version !== 1 || !/^[\w.-]+\/[\w.-]+$/.test(backlog.repository)) {
    throw new Error("Unsupported backlog version or invalid repository.");
  }
  const known = new Map();
  for (const issue of backlog.issues) {
    if (
      !/^CH-\d{2}$/.test(issue.id) ||
      known.has(issue.id) ||
      issue.id === backlog.tracking.id
    ) {
      throw new Error(`Invalid or duplicate issue ID: ${issue.id}`);
    }
    if (
      !issue.title ||
      !issue.goal ||
      !issue.acceptance?.length ||
      !["P0", "P1", "P2"].includes(issue.priority)
    ) {
      throw new Error(`Incomplete issue: ${issue.id}`);
    }
    known.set(issue.id, issue);
  }
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];
  function visit(issue) {
    if (visited.has(issue.id)) return;
    if (visiting.has(issue.id))
      throw new Error(`Dependency cycle at ${issue.id}`);
    visiting.add(issue.id);
    for (const id of issue.dependsOn) {
      if (!known.has(id))
        throw new Error(`Unknown dependency ${id} in ${issue.id}`);
      visit(known.get(id));
    }
    visiting.delete(issue.id);
    visited.add(issue.id);
    ordered.push(issue);
  }
  for (const issue of backlog.issues) visit(issue);
  if (backlog.revision) {
    const { id, summary, issueIds } = backlog.revision;
    if (
      !/^[a-z0-9-]+$/.test(id) ||
      !summary ||
      !Array.isArray(issueIds) ||
      new Set(issueIds).size !== issueIds.length ||
      issueIds.some(
        (target) => !known.has(target) && target !== backlog.tracking.id,
      )
    ) {
      throw new Error("Invalid backlog revision or target issue IDs.");
    }
  }
  return ordered;
}

function currentBody(body, backlog) {
  return revisionMarker(backlog)
    ? `${body}\n\n${revisionMarker(backlog)}`
    : body;
}

function revisedBody(body, previous, backlog) {
  const completed = new Set(
    [...previous.matchAll(/^- \[[xX]\] (.+)$/gm)].map((match) => match[1]),
  );
  const completedTickets = new Set(
    [...previous.matchAll(/^- \[[xX]\] \[(CH-\d{2})\b/gm)].map(
      (match) => match[1],
    ),
  );
  body = body.replace(/^- \[ \] (.+)$/gm, (line, text) =>
    completed.has(text) ||
    completedTickets.has(text.match(/^\[(CH-\d{2})\b/)?.[1])
      ? `- [x] ${text}`
      : line,
  );
  return [
    currentBody(body, backlog),
    `> **Current scope: product/SRD v0.2.** ${backlog.revision.summary} The scope above supersedes the earlier description retained below. Existing comments, status, and assignments remain in place.`,
    "<details>\n<summary>Previous description and implementation notes (historical scope)</summary>\n",
    previous.replace(/<!-- chorus-backlog:v1:CH-\d{2} -->\s*/, ""),
    "\n</details>",
  ].join("\n\n");
}

export function renderIssue(issue, backlog, byId) {
  const repository = `https://github.com/${backlog.repository}`;
  const tracker = byId.get(backlog.tracking.id);
  const dependencies = issue.dependsOn.length
    ? issue.dependsOn
        .map((id) => {
          const dependency = byId.get(id);
          if (!dependency)
            throw new Error(`Dependency ${id} has not been published.`);
          return `- [${id} #${dependency.number}](${dependency.html_url})`;
        })
        .join("\n")
    : "None. This issue can start immediately.";
  return [
    markerFor(issue.id),
    `**Priority:** ${issue.priority} · **Milestone:** ${issue.milestone}`,
    `**MVP tracker:** [#${tracker.number}](${tracker.html_url})`,
    "## Outcome",
    issue.goal,
    "## Scope",
    issue.scope.map((item) => `- ${item}`).join("\n"),
    "## Acceptance criteria",
    issue.acceptance.map((item) => `- [ ] ${item}`).join("\n"),
    "## Dependencies",
    dependencies,
    "## Requirements and verification",
    `SRD: ${issue.requirements.join(", ") || "Product delivery scope"}.`,
    `Acceptance tests: ${issue.tests.join(", ") || "Demonstration and documentation review"}.`,
    `[Product specification](${repository}/blob/main/docs/chorus-product-spec.md) · [SRD](${repository}/blob/main/docs/chorus-srd.md)`,
    "## Implementation notes",
    issue.notes,
  ].join("\n\n");
}

function renderTracker(backlog, byId) {
  const lines = [
    markerFor(backlog.tracking.id),
    "Deliver an AI-designed six-page photozine from shared images, voice notes, videos, and stories, with contributor-controlled source/processor release, final edition approval, and offline PDF download.",
    "The Next.js, Convex, shadcn/ui, and TanStack Router starter is already on main. The issues below cover the remaining implementation.",
    "## Priorities and completion",
    "P0 identifies consent and integration gates. P1 completes the required product and demonstration. Follow dependencies rather than sorting only by priority. P2 is optional stretch work.",
    "A complete MVP satisfies every MUST requirement in the SRD with evidence. Copying an authorized preview or downloaded PDF cannot be prevented or recalled.",
  ];
  for (const milestone of new Set(
    backlog.issues.map((issue) => issue.milestone),
  )) {
    lines.push(`## ${milestone}`);
    lines.push(
      backlog.issues
        .filter((issue) => issue.milestone === milestone)
        .map((issue) => {
          const published = byId.get(issue.id);
          return `- [ ] [${issue.id} #${published.number}](${published.html_url}) ${issue.title}`;
        })
        .join("\n"),
    );
  }
  lines.push(
    "## Delivery guidance",
    "CH-01 is underway and its authentication scope is unchanged. CH-20 can start in parallel using synthetic fixtures. Prove CH-02 before protected product flows. CH-18 is required AI design; CH-19 supplies consented derivatives. CH-09 and CH-18 can proceed in parallel once their own dependencies are met. CH-10 integrates both before final approval. Keep a complete manual recovery path; manual-only does not satisfy the AI requirement.",
  );
  return lines.join("\n\n");
}

export async function publishBacklog({
  github,
  context,
  core,
  backlog,
  pause = () => new Promise((resolve) => setTimeout(resolve, 1000)),
}) {
  backlog ??= JSON.parse(
    await readFile(
      new URL("../docs/backlog/issues.json", import.meta.url),
      "utf8",
    ),
  );
  const ordered = validateBacklog(backlog);
  const { owner, repo } = context.repo;
  if (`${owner}/${repo}`.toLowerCase() !== backlog.repository.toLowerCase()) {
    throw new Error(
      "Refusing to publish this backlog into a different repository.",
    );
  }
  const existing = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: "all",
    per_page: 100,
  });
  const byId = new Map();
  for (const issue of existing) {
    if (issue.pull_request) continue;
    const id = issue.body?.match(/<!-- chorus-backlog:v1:(CH-\d{2}) -->/)?.[1];
    if (!id) continue;
    if (byId.has(id))
      throw new Error(
        `Multiple existing issues have backlog ID ${id}; reconcile them before retrying.`,
      );
    byId.set(id, issue);
  }

  const labels = new Map(
    (
      await github.paginate(github.rest.issues.listLabelsForRepo, {
        owner,
        repo,
        per_page: 100,
      })
    ).map((label) => [label.name, label]),
  );
  const definitions = [
    ["priority:P0", "b60205"],
    ["priority:P1", "d93f0b"],
    ["priority:P2", "fbca04"],
    ...["security", "backend", "frontend", "quality", "docs"].map((area) => [
      `area:${area}`,
      "1d76db",
    ]),
    ...["feature", "spike", "task", "tracking"].map((type) => [
      `type:${type}`,
      "5319e7",
    ]),
  ];
  for (const [name, color] of definitions) {
    if (!labels.has(name)) {
      await github.rest.issues.createLabel({ owner, repo, name, color });
      await pause();
    }
  }
  const milestones = new Map(
    (
      await github.paginate(github.rest.issues.listMilestones, {
        owner,
        repo,
        state: "all",
        per_page: 100,
      })
    ).map((milestone) => [milestone.title, milestone.number]),
  );
  for (const title of new Set(backlog.issues.map((issue) => issue.milestone))) {
    if (!milestones.has(title)) {
      const { data } = await github.rest.issues.createMilestone({
        owner,
        repo,
        title,
      });
      milestones.set(title, data.number);
      await pause();
    }
  }

  const created = [];
  if (!byId.has(backlog.tracking.id)) {
    const { data } = await github.rest.issues.create({
      owner,
      repo,
      title: `[${backlog.tracking.id}] ${backlog.tracking.title}`,
      body: `${markerFor(backlog.tracking.id)}\n\n${trackerDraft}\n\nImplementation issues are being published. This checklist will be completed when publication succeeds.`,
      labels: ["type:tracking"],
    });
    byId.set(backlog.tracking.id, data);
    created.push(backlog.tracking.id);
    await pause();
  }
  for (const issue of ordered) {
    if (byId.has(issue.id)) continue;
    const { data } = await github.rest.issues.create({
      owner,
      repo,
      title: `[${issue.id}] ${issue.title}`,
      body: currentBody(renderIssue(issue, backlog, byId), backlog),
      labels: [
        `priority:${issue.priority}`,
        `area:${issue.area}`,
        `type:${issue.type}`,
      ],
      milestone: milestones.get(issue.milestone),
    });
    byId.set(issue.id, data);
    created.push(issue.id);
    await pause();
  }
  const tracker = byId.get(backlog.tracking.id);
  if (tracker.body?.includes(trackerDraft)) {
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: tracker.number,
      body: currentBody(renderTracker(backlog, byId), backlog),
    });
  }
  const updated = [];
  for (const id of backlog.revision?.issueIds ?? []) {
    const published = byId.get(id);
    if (created.includes(id)) continue;
    // Refresh immediately before editing so recent notes/checks are retained.
    const { data: latest } = await github.rest.issues.get({
      owner,
      repo,
      issue_number: published.number,
    });
    if (latest.body?.includes(revisionMarker(backlog))) continue;
    const issue = backlog.issues.find((item) => item.id === id);
    const generated = issue
      ? renderIssue(issue, backlog, byId)
      : renderTracker(backlog, byId);
    const params = {
      owner,
      repo,
      issue_number: latest.number,
      title: `[${id}] ${issue?.title ?? backlog.tracking.title}`,
      body: revisedBody(generated, latest.body ?? "", backlog),
    };
    if (issue) {
      const retainedLabels = (latest.labels ?? [])
        .map((label) => (typeof label === "string" ? label : label.name))
        .filter((name) => !/^(priority|area|type):/.test(name));
      params.labels = [
        ...retainedLabels,
        `priority:${issue.priority}`,
        `area:${issue.area}`,
        `type:${issue.type}`,
      ];
      params.milestone = milestones.get(issue.milestone);
    }
    await github.rest.issues.update(params);
    updated.push(id);
    await pause();
  }
  const result = {
    repository: backlog.repository,
    created,
    updated,
    issues: [backlog.tracking, ...backlog.issues].map(({ id }) => {
      const issue = byId.get(id);
      return { id, number: issue.number, url: issue.html_url };
    }),
  };
  core.info(
    `Backlog ready: ${result.issues.length} issues; ${created.length} created; ${updated.length} explicitly revised. Other issue text and all issue states/assignments were preserved.`,
  );
  return result;
}
