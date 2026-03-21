import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const MANAGED_MARKER = "<!-- issue-enrichment:managed -->";
const RAW_START_MARKER = "<!-- issue-enrichment:raw:start -->";
const RAW_END_MARKER = "<!-- issue-enrichment:raw:end -->";
const RAW_TITLE_PREFIX = "**Original title:** ";

const LABELS = {
  raw: "triage:raw",
  enriched: "triage:enriched",
  rerun: "triage:rerun",
};

const TYPE_LABELS = {
  feature: "type:feature",
  bug: "type:bug",
  content: "type:content",
  research: "type:research",
  chore: "type:chore",
  "needs-review": "type:needs-review",
};

const PRIORITY_LABELS = {
  high: "priority:high",
  medium: "priority:medium",
  low: "priority:low",
};

const REPOSITORY_LABEL_DEFINITIONS = [
  { name: LABELS.raw, color: "6e7781", description: "Short intake waiting for automatic enrichment." },
  { name: LABELS.enriched, color: "1f883d", description: "Issue expanded by the GitHub issue enrichment workflow." },
  { name: LABELS.rerun, color: "fb8f44", description: "Add this label to request a fresh enrichment pass." },
  { name: TYPE_LABELS.feature, color: "1f6feb", description: "Feature or product idea." },
  { name: TYPE_LABELS.bug, color: "d1242f", description: "Bug, regression, or broken behavior." },
  { name: TYPE_LABELS.content, color: "8250df", description: "Content, metadata, or catalog work." },
  { name: TYPE_LABELS.research, color: "0969da", description: "Question, spike, or investigation." },
  { name: TYPE_LABELS.chore, color: "57606a", description: "Maintenance or operational task." },
  { name: TYPE_LABELS["needs-review"], color: "bf8700", description: "Needs human classification before work starts." },
  { name: PRIORITY_LABELS.high, color: "b60205", description: "Likely urgent or high-impact." },
  { name: PRIORITY_LABELS.medium, color: "fbca04", description: "Moderate importance." },
  { name: PRIORITY_LABELS.low, color: "0e8a16", description: "Useful, but not obviously urgent." },
];

const ALLOWED_TYPES = new Set(Object.keys(TYPE_LABELS));
const ALLOWED_PRIORITIES = new Set(["high", "medium", "low", "unspecified"]);
const MANAGED_LABEL_PREFIXES = ["triage:", "type:", "priority:"];
const EMPTY_FIELD_VALUES = new Set(["_No response_", "_No original body was provided._"]);
const NORMALIZED_SECTION_KEYS = {
  "what is this?": "kind",
  "short description": "shortDescription",
  "desired outcome": "desiredOutcome",
  "context or link": "context",
};

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse ${label} as JSON: ${error.message}`);
  }
}

function getLabelNames(issue) {
  return (issue.labels ?? []).map((label) => label.name);
}

function hasLabel(issue, labelName) {
  return getLabelNames(issue).includes(labelName);
}

function extractRawIntake(issue) {
  const body = issue.body ?? "";
  const rawTitleMatch = body.match(/^\*\*Original title:\*\*\s*(.+)$/m);
  const rawBodyMatch = body.match(
    /<!-- issue-enrichment:raw:start -->\n([\s\S]*?)\n<!-- issue-enrichment:raw:end -->/
  );

  const preservedTitle = rawTitleMatch?.[1]?.trim();
  const preservedBody = rawBodyMatch?.[1] ?? "";
  const normalizedBody = preservedBody.trim() === "_No original body was provided._" ? "" : preservedBody.trim();

  return {
    title: preservedTitle || issue.title,
    body: rawBodyMatch ? normalizedBody : body,
  };
}

function parseFormSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = {};
  let currentHeading = null;
  let buffer = [];

  const flush = () => {
    if (!currentHeading) {
      return;
    }

    sections[currentHeading] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.*)$/);

    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1].trim();
      continue;
    }

    if (currentHeading) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return EMPTY_FIELD_VALUES.has(trimmed) ? "" : trimmed;
}

function normalizeFormSections(sections) {
  const normalized = {
    kind: "",
    shortDescription: "",
    desiredOutcome: "",
    context: "",
    extraSections: {},
  };

  for (const [heading, value] of Object.entries(sections)) {
    const normalizedValue = normalizeOptionalText(value);

    if (!normalizedValue) {
      continue;
    }

    const normalizedKey = NORMALIZED_SECTION_KEYS[heading.trim().toLowerCase()];

    if (normalizedKey) {
      normalized[normalizedKey] = normalizedValue;
      continue;
    }

    normalized.extraSections[heading] = normalizedValue;
  }

  return normalized;
}

function stripIntakePrefix(title) {
  return title.replace(/^\[intake\]\s*/i, "").trim();
}

function splitPhraseCandidates(text) {
  return text
    .split(/[\n,;|]+/)
    .map((part) => part.replace(/^[\-:*\s]+|[\-:*\s]+$/g, "").trim())
    .filter(Boolean);
}

function extractAnchorPhrases(rawIntake, normalizedFields) {
  const candidates = [
    normalizedFields.shortDescription,
    normalizedFields.desiredOutcome,
    normalizedFields.context,
    stripIntakePrefix(rawIntake.title),
  ];

  const unique = new Set();

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeOptionalText(candidate);

    if (!normalizedCandidate) {
      continue;
    }

    for (const phrase of splitPhraseCandidates(normalizedCandidate)) {
      if (phrase.length < 3 || phrase.length > 80) {
        continue;
      }

      unique.add(phrase);
    }
  }

  return [...unique].slice(0, 6);
}

function buildSourceSignals(rawIntake, normalizedFields) {
  const populatedFields = [
    normalizedFields.kind,
    normalizedFields.shortDescription,
    normalizedFields.desiredOutcome,
    normalizedFields.context,
  ].filter(Boolean);
  const shortDescriptionWordCount = normalizedFields.shortDescription
    ? normalizedFields.shortDescription.split(/\s+/).filter(Boolean).length
    : 0;
  const detailLevel =
    populatedFields.length <= 2 && shortDescriptionWordCount <= 4
      ? "minimal"
      : populatedFields.length <= 3
        ? "moderate"
        : "detailed";

  return {
    detailLevel,
    populatedFieldCount: populatedFields.length,
    hasDesiredOutcome: Boolean(normalizedFields.desiredOutcome),
    hasContext: Boolean(normalizedFields.context),
    titleWithoutPrefix: stripIntakePrefix(rawIntake.title),
    anchorPhrases: extractAnchorPhrases(rawIntake, normalizedFields),
  };
}

function buildModelPayload(issue, rawIntake) {
  const sections = parseFormSections(rawIntake.body);
  const normalizedFields = normalizeFormSections(sections);

  return {
    repository: process.env.GITHUB_REPOSITORY,
    issueNumber: issue.number,
    currentTitle: issue.title,
    existingLabels: getLabelNames(issue),
    rawTitle: rawIntake.title,
    rawBody: rawIntake.body,
    parsedSections: sections,
    normalizedFields,
    sourceSignals: buildSourceSignals(rawIntake, normalizedFields),
  };
}

function assertString(value, field, minLength = 1) {
  if (typeof value !== "string" || value.trim().length < minLength) {
    throw new Error(`Model response field '${field}' must be a string with at least ${minLength} characters.`);
  }

  return value.trim();
}

function assertStringArray(value, field, minItems = 0) {
  if (!Array.isArray(value) || value.length < minItems || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Model response field '${field}' must be an array of non-empty strings.`);
  }

  return value.map((item) => item.trim());
}

function validateEnrichment(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Model response must be a JSON object.");
  }

  const enrichment = {
    enrichedTitle: assertString(candidate.enrichedTitle, "enrichedTitle", 8),
    summary: assertString(candidate.summary, "summary", 20),
    problem: assertString(candidate.problem, "problem", 20),
    desiredOutcome: assertString(candidate.desiredOutcome, "desiredOutcome", 20),
    acceptanceCriteria: assertStringArray(candidate.acceptanceCriteria, "acceptanceCriteria", 2),
    type: assertString(candidate.type, "type", 3),
    priority: assertString(candidate.priority, "priority", 3),
    caveats: assertStringArray(candidate.caveats ?? [], "caveats", 0),
    openQuestions: assertStringArray(candidate.openQuestions ?? [], "openQuestions", 0),
  };

  if (!ALLOWED_TYPES.has(enrichment.type)) {
    throw new Error(`Model response type '${enrichment.type}' is not allowed.`);
  }

  if (!ALLOWED_PRIORITIES.has(enrichment.priority)) {
    throw new Error(`Model response priority '${enrichment.priority}' is not allowed.`);
  }

  return enrichment;
}

function formatBulletList(items, emptyMessage) {
  if (!items.length) {
    return `- ${emptyMessage}`;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatChecklist(items, emptyMessage) {
  if (!items.length) {
    return `- [ ] ${emptyMessage}`;
  }

  return items.map((item) => `- [ ] ${item}`).join("\n");
}

function formatLabelValue(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildIssueBody(rawIntake, enrichment) {
  const rawBody = rawIntake.body.trim() || "_No original body was provided._";

  return [
    MANAGED_MARKER,
    "## 🧾 Snapshot",
    "| Field | Value |",
    "| --- | --- |",
    `| Type | ${formatLabelValue(enrichment.type)} |`,
    `| Priority | ${formatLabelValue(enrichment.priority)} |`,
    "",
    "## Summary",
    enrichment.summary,
    "",
    "## Problem / Opportunity",
    enrichment.problem,
    "",
    "## Desired Outcome",
    enrichment.desiredOutcome,
    "",
    "## ✅ Acceptance Checklist",
    formatChecklist(enrichment.acceptanceCriteria, "Review criteria were not generated."),
    "",
    "## 📝 Notes & Questions",
    "### Caveats",
    formatBulletList(enrichment.caveats, "The source intake is sparse and should be reviewed before planning work."),
    "",
    "### Open Questions",
    formatBulletList(enrichment.openQuestions, "No open questions were detected from the intake, but human review is still recommended."),
    "",
    "## Original Intake",
    `${RAW_TITLE_PREFIX}${rawIntake.title}`,
    "",
    RAW_START_MARKER,
    rawBody,
    RAW_END_MARKER,
    "",
    "---",
    "This issue was expanded automatically from a short intake. Edit the issue while it still has `triage:raw`, or add `triage:rerun` to regenerate it.",
  ].join("\n");
}

function buildNextLabels(existingLabels, enrichment) {
  const preserved = existingLabels.filter(
    (label) => !MANAGED_LABEL_PREFIXES.some((prefix) => label.startsWith(prefix))
  );

  const managed = [LABELS.enriched, TYPE_LABELS[enrichment.type]];

  if (enrichment.priority !== "unspecified") {
    managed.push(PRIORITY_LABELS[enrichment.priority]);
  }

  return [...new Set([...preserved, ...managed])].sort();
}

async function readTextFile(path) {
  return readFile(path, "utf8");
}

async function githubRequest(path, { method = "GET", body } = {}) {
  const token = getRequiredEnv("GITHUB_TOKEN");
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const raw = await response.text();
  const parsed = raw ? parseJson(raw, `GitHub response for ${path}`) : null;

  if (!response.ok) {
    const message = parsed?.message || raw || `${response.status} ${response.statusText}`;
    const error = new Error(`GitHub API request failed (${method} ${path}): ${message}`);
    error.status = response.status;
    error.details = parsed;
    throw error;
  }

  return parsed;
}

function getMissingRepositoryLabels(existingLabelNames) {
  const existing = new Set(existingLabelNames);
  return REPOSITORY_LABEL_DEFINITIONS.filter((label) => !existing.has(label.name));
}

function isLabelAlreadyExistsError(error) {
  const alreadyExists = error?.details?.errors?.some(
    (detail) => detail?.code === "already_exists" && (!detail?.resource || detail.resource === "Label")
  );

  return alreadyExists || String(error?.message).includes("already_exists");
}

async function fetchRepositoryLabelNames(repository) {
  const labels = await githubRequest(`/repos/${repository}/labels?per_page=100`);
  return labels.map((label) => label.name);
}

async function ensureRepositoryLabels(repository) {
  const existingLabelNames = await fetchRepositoryLabelNames(repository);

  for (const label of getMissingRepositoryLabels(existingLabelNames)) {
    try {
      await githubRequest(`/repos/${repository}/labels`, {
        method: "POST",
        body: label,
      });
    } catch (error) {
      if (!isLabelAlreadyExistsError(error)) {
        throw error;
      }
    }
  }
}

async function fetchCurrentIssue(repository, issueNumber) {
  return githubRequest(`/repos/${repository}/issues/${issueNumber}`);
}

async function updateIssue(repository, issueNumber, payload) {
  return githubRequest(`/repos/${repository}/issues/${issueNumber}`, {
    method: "PATCH",
    body: payload,
  });
}

async function requestEnrichment(modelPayload) {
  const [prompt, schemaText] = await Promise.all([
    readTextFile(".github/issue-enrichment/prompt.md"),
    readTextFile(".github/issue-enrichment/schema.json"),
  ]);

  if (process.env.MOCK_MODEL_RESPONSE_PATH) {
    const mock = await readTextFile(process.env.MOCK_MODEL_RESPONSE_PATH);
    return validateEnrichment(parseJson(mock, "mock model response"));
  }

  const token = getRequiredEnv("GITHUB_TOKEN");
  const model = process.env.GITHUB_MODELS_MODEL || "openai/gpt-4.1-mini";
  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      top_p: 1,
      seed: 7,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            "Return JSON that matches this schema description exactly:",
            schemaText,
            "",
            "Issue intake payload:",
            JSON.stringify(modelPayload, null, 2),
          ].join("\n"),
        },
      ],
    }),
  });

  const raw = await response.text();
  const parsed = raw ? parseJson(raw, "GitHub Models response") : null;

  if (!response.ok) {
    const message = parsed?.error?.message || raw || `${response.status} ${response.statusText}`;
    throw new Error(`GitHub Models request failed: ${message}`);
  }

  const content = parsed?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("GitHub Models response did not contain message content.");
  }

  return validateEnrichment(parseJson(content, "model message content"));
}

function shouldProcessIssue(event, issue) {
  if (process.env.GITHUB_ACTOR === "github-actions[bot]" || event.sender?.login === "github-actions[bot]") {
    return false;
  }

  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    return true;
  }

  if (event.action === "opened") {
    return true;
  }

  if (event.action === "edited") {
    return hasLabel(issue, LABELS.raw) || hasLabel(issue, LABELS.rerun);
  }

  if (event.action === "labeled") {
    return event.label?.name === LABELS.rerun;
  }

  return false;
}

function getIssueNumberFromEvent(event) {
  if (event.issue?.number) {
    return event.issue.number;
  }

  const dispatchValue = process.env.INPUT_ISSUE_NUMBER || process.env.ISSUE_NUMBER;
  if (dispatchValue) {
    return Number.parseInt(dispatchValue, 10);
  }

  throw new Error("Could not determine issue number from event payload.");
}

async function main() {
  const eventPath = getRequiredEnv("GITHUB_EVENT_PATH");
  const repository = getRequiredEnv("GITHUB_REPOSITORY");
  const dryRun = process.env.DRY_RUN === "1";
  const event = parseJson(await readTextFile(eventPath), "GitHub event payload");
  const issueNumber = getIssueNumberFromEvent(event);

  const issue = dryRun ? event.issue : await fetchCurrentIssue(repository, issueNumber);

  if (!shouldProcessIssue(event, issue)) {
    console.log(`Skipping issue #${issueNumber}; trigger conditions not met.`);
    return;
  }

  if (!dryRun) {
    await ensureRepositoryLabels(repository);
  }

  const rawIntake = extractRawIntake(issue);
  const modelPayload = buildModelPayload(issue, rawIntake);
  const enrichment = await requestEnrichment(modelPayload);
  const nextTitle = enrichment.enrichedTitle;
  const nextBody = buildIssueBody(rawIntake, enrichment);
  const nextLabels = buildNextLabels(getLabelNames(issue), enrichment);
  const updatePayload = {
    title: nextTitle,
    body: nextBody,
    labels: nextLabels,
  };

  if (dryRun) {
    console.log(JSON.stringify(updatePayload, null, 2));
    return;
  }

  await updateIssue(repository, issueNumber, updatePayload);
  console.log(`Enriched issue #${issueNumber} with labels: ${nextLabels.join(", ")}`);
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { getMissingRepositoryLabels, isLabelAlreadyExistsError };
