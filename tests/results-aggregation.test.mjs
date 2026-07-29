import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aggregateReviewResults } from "../app/results/aggregate.mjs";

const evaluation = JSON.parse(
  await readFile(new URL("../public/evaluation.json", import.meta.url), "utf8"),
);

function completeSubmission(name, overrides = {}) {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    reviewer: name,
    submitted_at: "2026-07-29T18:00:00.000Z",
    reviews: Object.fromEntries(
      evaluation.lines.map((line) => [
        line.id,
        overrides[line.id] ?? {
          status: "approved_as_written",
          corrected_text: "",
          note: "",
        },
      ]),
    ),
  };
}

test("shows a truthful empty state before a real review arrives", () => {
  const result = aggregateReviewResults(evaluation, []);
  assert.equal(result.summary.reviewer_count, 0);
  assert.equal(result.summary.accepted_lines, 0);
  assert.equal(result.summary.unreviewed_lines, 50);
  assert.equal(result.summary.ready_to_lock, false);
  assert.equal(
    Object.values(result.domains).every((domain) => domain.accepted === 0),
    true,
  );
});

test("passes a complete all-domain native-speaker review", () => {
  const result = aggregateReviewResults(evaluation, [
    completeSubmission("Tantine"),
  ]);
  assert.equal(result.summary.reviewer_count, 1);
  assert.equal(result.summary.accepted_lines, 50);
  assert.equal(result.summary.unreviewed_lines, 0);
  assert.equal(result.summary.gate_requirements_met, true);
  assert.equal(result.summary.ready_to_lock, true);
  assert.equal(
    Object.values(result.domains).every((domain) => domain.passed),
    true,
  );
});

test("keeps different speaker wording visible as a conflict", () => {
  const line = evaluation.lines[0];
  const result = aggregateReviewResults(evaluation, [
    completeSubmission("Tantine"),
    completeSubmission("Speaker Two", {
      [line.id]: {
        status: "approved_with_correction",
        corrected_text: `${line.text} solo`,
        note: "Alternative wording",
      },
    }),
  ]);
  const conflict = result.lines.find((item) => item.id === line.id);
  assert.equal(conflict.resolution, "conflict");
  assert.deepEqual(conflict.reasons, ["different_approved_texts"]);
  assert.equal(result.summary.conflict_lines, 1);
  assert.equal(result.summary.ready_to_lock, false);
});
