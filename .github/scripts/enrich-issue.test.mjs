import test from "node:test";
import assert from "node:assert/strict";

import {
  getMissingRepositoryLabels,
  isLabelAlreadyExistsError,
} from "./enrich-issue.mjs";

test("getMissingRepositoryLabels only returns labels that do not exist yet", () => {
  const missing = getMissingRepositoryLabels([
    "triage:raw",
    "triage:enriched",
    "type:feature",
    "priority:medium",
  ]);

  assert.deepEqual(
    missing.map((label) => label.name),
    [
      "triage:rerun",
      "type:bug",
      "type:content",
      "type:research",
      "type:chore",
      "type:needs-review",
      "priority:high",
      "priority:low",
    ]
  );
});

test("isLabelAlreadyExistsError treats GitHub validation errors as non-fatal duplicates", () => {
  const error = new Error("Validation Failed");
  error.status = 422;
  error.details = {
    message: "Validation Failed",
    errors: [
      {
        resource: "Label",
        code: "already_exists",
        field: "name",
      },
    ],
  };

  assert.equal(isLabelAlreadyExistsError(error), true);
});
