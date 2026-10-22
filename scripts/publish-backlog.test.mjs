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
        update: async ({ issue_number, body }) => {
          const data = state.issues.find(
            (issue) => issue.number === issue_number,
          );
          data.body = body;
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
