import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { publishBacklog, validateBacklog } from "./publish-backlog.mjs";

const source = JSON.parse(
  await readFile(
    new URL("../docs/backlog/issues.json", import.meta.url),
    "utf8",
  ),
);
const marker = (id) => `<!-- chorus-backlog:v1:${id} -->`;

function fixture() {
  const state = {
    issues: [],
    labels: [],
    milestones: [],
    nextNumber: 101,
    failAfterCreating: null,
    failAfterUpdating: null,
  };
  const listForRepo = async () => state.issues;
  const listLabelsForRepo = async () => state.labels;
  const listMilestones = async () => state.milestones;
  const github = {
    paginate: (method, params) => method(params),
    rest: {
      issues: {
        listForRepo,
        listLabelsForRepo,
        listMilestones,
        createLabel: async ({ name }) => {
          state.labels.push({ name });
          return { data: { name } };
        },
        createMilestone: async ({ title }) => {
          const data = { title, number: state.milestones.length + 1 };
          state.milestones.push(data);
          return { data };
        },
        create: async (params) => {
          const number = state.nextNumber++;
          const data = {
            ...params,
            number,
            html_url: `https://github.com/TrnLinh/hackathon/issues/${number}`,
            state: "open",
          };
          state.issues.push(data);
          if (params.title.startsWith(state.failAfterCreating ?? "NEVER")) {
            state.failAfterCreating = null;
            throw new Error("Response lost after GitHub committed the issue");
          }
          return { data };
        },
        get: async ({ issue_number }) => ({
          data: structuredClone(
            state.issues.find((issue) => issue.number === issue_number),
          ),
        }),
        update: async ({ issue_number, ...params }) => {
          const data = state.issues.find(
            (issue) => issue.number === issue_number,
          );
          Object.assign(data, params);
          if (data.title.startsWith(state.failAfterUpdating ?? "NEVER")) {
            state.failAfterUpdating = null;
            throw new Error("Response lost after GitHub updated the issue");
          }
          return { data };
        },
      },
    },
  };
  const options = {
    github,
    context: { repo: { owner: "TrnLinh", repo: "hackathon" } },
    core: { info() {} },
    backlog: structuredClone(source),
    pause: async () => {},
  };
  return { state, options };
}

test("creates linked issues and preserves existing issue edits and closed state on rerun", async () => {
  const { state, options } = fixture();
  const result = await publishBacklog(options);
  assert.equal(result.issues.length, source.issues.length + 1);
  for (const issue of source.issues) {
    const published = state.issues.find((item) =>
      item.body.includes(marker(issue.id)),
    );
    for (const dependency of issue.dependsOn) {
      const target = result.issues.find((item) => item.id === dependency);
      assert.ok(published.body.includes(`${dependency} #${target.number}`));
    }
  }
  const humanEdited = state.issues.find((issue) =>
    issue.body.includes(marker("CH-03")),
  );
  humanEdited.body += "\n\nHuman implementation notes to retain.";
  humanEdited.state = "closed";
  const editedBody = humanEdited.body;
  const second = await publishBacklog(options);
  assert.deepEqual(second.created, []);
  assert.equal(state.issues.length, result.issues.length);
  assert.equal(humanEdited.body, editedBody);
  assert.equal(humanEdited.state, "closed");
  assert.equal(
    state.issues.filter((issue) => issue.body.includes("tracker-draft")).length,
    0,
  );
});

test("resumes after a lost response without creating a duplicate issue", async () => {
  const { state, options } = fixture();
  state.failAfterCreating = "[CH-06]";
  await assert.rejects(publishBacklog(options), /Response lost/);
  await publishBacklog(options);
  for (const issue of [source.tracking, ...source.issues]) {
    assert.equal(
      state.issues.filter((item) => item.body.includes(marker(issue.id)))
        .length,
      1,
    );
  }
  const tracker = state.issues.find((issue) =>
    issue.body.includes(marker(source.tracking.id)),
  );
  assert.ok(tracker.body.includes("CH-18"));
  assert.ok(!tracker.body.includes("tracker-draft"));
});

test("refuses ambiguous existing markers and publication into another repository", async () => {
  const { state, options } = fixture();
  state.issues.push({ body: marker("CH-01") }, { body: marker("CH-01") });
  await assert.rejects(publishBacklog(options), /Multiple existing issues/);
  assert.equal(state.labels.length, 0);
  const other = fixture();
  other.options.context.repo.repo = "unrelated";
  await assert.rejects(publishBacklog(other.options), /different repository/);
  assert.equal(other.state.issues.length, 0);
});

test("rejects missing dependencies, duplicate IDs, and dependency cycles before publication", () => {
  const missing = structuredClone(source);
  missing.issues[0].dependsOn = ["CH-99"];
  assert.throws(() => validateBacklog(missing), /Unknown dependency/);
  const duplicate = structuredClone(source);
  duplicate.issues.push(duplicate.issues[0]);
  assert.throws(() => validateBacklog(duplicate), /duplicate issue ID/);
  const cycle = structuredClone(source);
  cycle.issues[0].dependsOn = ["CH-02"];
  assert.throws(() => validateBacklog(cycle), /Dependency cycle/);
});

test("explicit revisions preserve active CH-01, previous notes, completed criteria, state, and custom labels", async () => {
  const { state, options } = fixture();
  const legacy = structuredClone(source);
  delete legacy.revision;
  legacy.issues = legacy.issues.filter(
    (issue) => !["CH-19", "CH-20"].includes(issue.id),
  );
  for (const issue of legacy.issues) {
    issue.dependsOn = issue.dependsOn.filter(
      (id) => !["CH-19", "CH-20"].includes(id),
    );
  }
  await publishBacklog({ ...options, backlog: legacy });
  const active = state.issues.find((issue) =>
    issue.title.startsWith("[CH-01]"),
  );
  active.body += "\n\nIn progress: keep these auth implementation notes.";
  active.assignees = ["developer"];
  const activeBefore = structuredClone(active);
  const ai = state.issues.find((issue) => issue.title.startsWith("[CH-18]"));
  const criterion = source.issues.find((issue) => issue.id === "CH-18")
    .acceptance[0];
  ai.body = ai.body.replace(`- [ ] ${criterion}`, `- [x] ${criterion}`);
  ai.body += "\n\nDeveloper notes about an existing experiment.";
  ai.state = "closed";
  ai.assignees = ["another-developer"];
  ai.labels = [{ name: "team:design" }, { name: "priority:P2" }];
  const previous = ai.body;
  const result = await publishBacklog(options);
  assert.deepEqual(active, activeBefore);
  assert.ok(result.created.includes("CH-19"));
  assert.ok(result.created.includes("CH-20"));
  assert.ok(result.updated.includes("CH-18"));
  assert.ok(!result.updated.includes("CH-01"));
  assert.ok(
    ai.body.includes(
      previous.replace(/<!-- chorus-backlog:v1:CH-18 -->\s*/, ""),
    ),
  );
  assert.ok(ai.body.includes(`- [x] ${criterion}`));
  assert.equal(ai.state, "closed");
  assert.deepEqual(ai.assignees, ["another-developer"]);
  assert.ok(ai.labels.includes("team:design"));
  assert.ok(ai.labels.includes("priority:P1"));
  assert.ok(!ai.labels.includes("priority:P2"));
  const completed = structuredClone(state.issues);
  const repeat = await publishBacklog(options);
  assert.deepEqual(repeat.created, []);
  assert.deepEqual(repeat.updated, []);
  assert.deepEqual(state.issues, completed);
});

test("resumes a revision after a lost update response without nesting historical copies", async () => {
  const { state, options } = fixture();
  await publishBacklog(options);
  const ai = state.issues.find((issue) => issue.title.startsWith("[CH-18]"));
  ai.body = ai.body.replace(
    `<!-- chorus-backlog:revision:${source.revision.id} -->`,
    "",
  );
  state.failAfterUpdating = "[CH-18]";
  await assert.rejects(
    publishBacklog(options),
    /Response lost after GitHub updated/,
  );
  const updated = ai.body;
  const resumed = await publishBacklog(options);
  assert.deepEqual(resumed.updated, []);
  assert.equal(ai.body, updated);
  assert.equal(ai.body.match(/<details>/g).length, 1);
});

test("rejects invalid revision targets before publication", () => {
  const invalid = structuredClone(source);
  invalid.revision.issueIds.push("CH-99");
  assert.throws(() => validateBacklog(invalid), /Invalid backlog revision/);
});

test("a later revision uses its document version and does not restore historical completion marks", async () => {
  const { state, options } = fixture();
  await publishBacklog(options);
  const ai = state.issues.find((issue) => issue.title.startsWith("[CH-18]"));
  const criterion = source.issues.find((issue) => issue.id === "CH-18")
    .acceptance[0];
  ai.body += `\n\n<details>\n<summary>Previous description and implementation notes (historical scope)</summary>\n\n- [x] ${criterion}\n\nOld notes with \`\`\`code fences\`\`\`.\n</details>`;
  const previous = ai.body;
  const revised = structuredClone(source);
  revised.revision = {
    id: "next-revision-test",
    documentVersion: "0.2.2",
    summary: "Synthetic revision for preservation checks.",
    issueIds: ["CH-18"],
  };
  await publishBacklog({ ...options, backlog: revised });
  const current = ai.body.slice(0, ai.body.indexOf("<details>"));
  assert.ok(current.includes(`- [ ] ${criterion}`));
  assert.ok(!current.includes(`- [x] ${criterion}`));
  assert.ok(current.includes("Current scope: product/SRD v0.2.2"));
  assert.ok(
    ai.body.includes(
      previous.replace(/<!-- chorus-backlog:v1:CH-18 -->\s*/, ""),
    ),
  );
  assert.ok(ai.body.includes("````markdown"));
});
