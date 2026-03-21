# GitHub-native issue enrichment

This repository includes a GitHub-native intake flow for turning very short issues into clearer review tickets.

## What it does

1. A contributor opens `Quick intake` from `.github/ISSUE_TEMPLATE/quick-intake.yml`.
2. GitHub creates the issue with the short mobile-friendly input.
3. `.github/workflows/issue-enrichment.yml` runs on issue open, eligible edits, and the `triage:rerun` label.
4. `.github/scripts/enrich-issue.mjs` reads the issue, loads `.github/issue-enrichment/prompt.md`, and sends the intake to GitHub Models.
5. The script validates the JSON response against the shape documented in `.github/issue-enrichment/schema.json`.
6. The issue is updated in place with:
   - an enriched title written in the selected output language (`Auto`, `Spanish`, or `English`)
   - a clearer body with a compact snapshot table, concise narrative sections, a checkbox-style acceptance checklist, and grouped caveats/open questions in the selected or inferred language
   - preserved raw intake content
   - managed labels such as `triage:enriched`, `type:*`, and optional `priority:*`

The result stays as a normal GitHub issue for manual review and later planning.

## Managed labels

The workflow auto-creates these labels if they do not exist yet:

- `triage:raw`
- `triage:enriched`
- `triage:rerun`
- `type:feature`
- `type:bug`
- `type:content`
- `type:research`
- `type:chore`
- `type:needs-review`
- `priority:high`
- `priority:medium`
- `priority:low`

## Trigger rules

- `opened`: always attempts enrichment.
- `edited`: re-runs only while the issue still has `triage:raw`, or when `triage:rerun` is present.
- `labeled`: re-runs when the added label is `triage:rerun`.
- `github-actions[bot]` events are ignored to avoid edit/label loops.

## Output language

- `Auto`: the script infers Spanish vs English from the intake content and passes the resolved language to the model.
- `Spanish`: the enriched title and issue body are written in Spanish.
- `English`: the enriched title and issue body are written in English.
- Labels and internal workflow conventions stay in English regardless of the selected output language.

## Manual re-run

Use either of these:

- edit the issue before it has been enriched
- add the `triage:rerun` label to an already enriched issue

After a successful run, the workflow removes the raw/rerun state by replacing managed labels with the latest `triage:enriched`, `type:*`, and optional `priority:*` set.

## GitHub settings Carlos must enable

1. `Settings -> Actions -> General -> Actions permissions`: allow GitHub Actions to run.
2. `Settings -> Actions -> General -> Workflow permissions`: set `Read and write permissions` for `GITHUB_TOKEN`.
3. Ensure the account or org that owns `Carlos11932/rollorian-books` has GitHub Models access. The workflow requests `models: read` and uses the default `GITHUB_TOKEN`.
4. If your GitHub Models access is too limited for the expected volume, opt in to paid GitHub Models usage in GitHub billing.

## Local smoke test

You can preview the generated issue update without calling GitHub APIs:

```bash
DRY_RUN=1 \
GITHUB_EVENT_PATH=.github/issue-enrichment/examples/sample-issue-event.json \
GITHUB_REPOSITORY=Carlos11932/rollorian-books \
GITHUB_EVENT_NAME=issues \
GITHUB_ACTOR=Carlos11932 \
MOCK_MODEL_RESPONSE_PATH=.github/issue-enrichment/examples/sample-model-response.json \
node .github/scripts/enrich-issue.mjs
```

This prints the title/body/labels payload that would be sent back to GitHub.

The generated body now uses this structure:

```md
## 🧾 Snapshot
| Field | Value |
| --- | --- |
| Type | Feature |
| Priority | Medium |

## Summary
One short paragraph.

## Problem / Opportunity
One short paragraph.

## Desired Outcome
One short paragraph.

## ✅ Acceptance Checklist
- [ ] Reviewable outcome
- [ ] Reviewable outcome

## 📝 Notes & Questions
### Caveats
- Constraint or ambiguity

### Open Questions
- Follow-up needed from humans

## Original Intake
...
```

The only decorative elements are two small section emojis and the checklist format. The layout stays compact enough for mobile review.

## Caveats

- GitHub Models can still rate-limit or reject requests depending on the account plan and current availability.
- The enrichment is intentionally conservative. Sparse inputs stay sparse, but they become easier to review.
- The workflow replaces only managed labels. Any unrelated labels remain untouched.
