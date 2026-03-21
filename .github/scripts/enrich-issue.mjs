import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const MANAGED_MARKER = "<!-- issue-enrichment:managed -->";
const RAW_TITLE_START_MARKER = "<!-- issue-enrichment:raw-title:start -->";
const RAW_TITLE_END_MARKER = "<!-- issue-enrichment:raw-title:end -->";
const RAW_START_MARKER = "<!-- issue-enrichment:raw:start -->";
const RAW_END_MARKER = "<!-- issue-enrichment:raw:end -->";
const OUTPUT_LANGUAGES = {
  auto: "auto",
  english: "english",
  spanish: "spanish",
};

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
  "output language": "outputLanguage",
  "context or link": "context",
};

const LANGUAGE_COPY = {
  english: {
    snapshotHeading: "## 🧾 Snapshot",
    tableHeader: "| Field | Value |",
    typeLabel: "Type",
    priorityLabel: "Priority",
    summaryHeading: "## Summary",
    problemHeading: "## Problem / Opportunity",
    desiredOutcomeHeading: "## Desired Outcome",
    acceptanceHeading: "## ✅ Acceptance Checklist",
    notesHeading: "## 📝 Notes & Questions",
    caveatsHeading: "### Caveats",
    openQuestionsHeading: "### Open Questions",
    originalIntakeHeading: "## Original Intake",
    originalTitleLabel: "Original title",
    noOriginalBody: "_No original body was provided._",
    acceptanceFallback: "Review criteria were not generated.",
    caveatsFallback: "The source intake is sparse and should be reviewed before planning work.",
    openQuestionsFallback: "No open questions were detected from the intake, but human review is still recommended.",
    footer:
      "This issue was expanded automatically from a short intake. Edit the issue while it still has `triage:raw`, or add `triage:rerun` to regenerate it.",
    typeValues: {
      feature: "Feature",
      bug: "Bug",
      content: "Content",
      research: "Research",
      chore: "Chore",
      "needs-review": "Needs Review",
    },
    priorityValues: {
      high: "High",
      medium: "Medium",
      low: "Low",
      unspecified: "Unspecified",
    },
  },
  spanish: {
    snapshotHeading: "## 🧾 Resumen rapido",
    tableHeader: "| Campo | Valor |",
    typeLabel: "Tipo",
    priorityLabel: "Prioridad",
    summaryHeading: "## Resumen",
    problemHeading: "## Problema / Oportunidad",
    desiredOutcomeHeading: "## Resultado esperado",
    acceptanceHeading: "## ✅ Checklist de aceptacion",
    notesHeading: "## 📝 Notas y preguntas",
    caveatsHeading: "### Consideraciones",
    openQuestionsHeading: "### Preguntas abiertas",
    originalIntakeHeading: "## Intake original",
    originalTitleLabel: "Titulo original",
    noOriginalBody: "_No se proporciono un cuerpo original._",
    acceptanceFallback: "No se generaron criterios de revision.",
    caveatsFallback: "El intake original es escaso y conviene revisarlo antes de planificar trabajo.",
    openQuestionsFallback: "No se detectaron preguntas abiertas en el intake, pero sigue siendo recomendable una revision humana.",
    footer:
      "Este issue se amplio automaticamente a partir de un intake breve. Editalo mientras siga teniendo `triage:raw`, o anade `triage:rerun` para regenerarlo.",
    typeValues: {
      feature: "Funcionalidad",
      bug: "Error",
      content: "Contenido",
      research: "Investigacion",
      chore: "Mantenimiento",
      "needs-review": "Necesita revision",
    },
    priorityValues: {
      high: "Alta",
      medium: "Media",
      low: "Baja",
      unspecified: "Sin especificar",
    },
  },
};

const LANGUAGE_DETECTION = {
  spanish: [
    " el ",
    " la ",
    " los ",
    " las ",
    " para ",
    " con ",
    " cuando ",
    " que ",
    " una ",
    " un ",
    " no ",
    " deberia ",
    " deberia",
    " mejorar ",
    " busqueda ",
    " biblioteca ",
    " pagina ",
  ],
  english: [
    " the ",
    " and ",
    " for ",
    " with ",
    " when ",
    " should ",
    " improve ",
    " search ",
    " library ",
    " page ",
    " user ",
    " users ",
    " empty ",
  ],
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
  const rawTitleMarkerMatch = body.match(
    /<!-- issue-enrichment:raw-title:start -->\n([\s\S]*?)\n<!-- issue-enrichment:raw-title:end -->/
  );
  const rawTitleMatch = body.match(/^\*\*(?:Original title|Titulo original|T\xedtulo original):\*\*\s*(.+)$/m);
  const rawBodyMatch = body.match(
    /<!-- issue-enrichment:raw:start -->\n([\s\S]*?)\n<!-- issue-enrichment:raw:end -->/
  );

  const preservedTitle = rawTitleMarkerMatch?.[1]?.trim() || rawTitleMatch?.[1]?.trim();
  const preservedBody = rawBodyMatch?.[1] ?? "";
  const trimmedBody = preservedBody.trim();
  const normalizedBody =
    trimmedBody === "_No original body was provided._" || trimmedBody === "_No se proporciono un cuerpo original._"
      ? ""
      : trimmedBody;

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
    outputLanguage: OUTPUT_LANGUAGES.auto,
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
      normalized[normalizedKey] = normalizedKey === "outputLanguage" ? normalizeOutputLanguage(normalizedValue) : normalizedValue;
      continue;
    }

    normalized.extraSections[heading] = normalizedValue;
  }

  return normalized;
}

function normalizeOutputLanguage(value) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "spanish") {
    return OUTPUT_LANGUAGES.spanish;
  }

  if (normalized === "english") {
    return OUTPUT_LANGUAGES.english;
  }

  return OUTPUT_LANGUAGES.auto;
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

function buildLanguageSample(rawIntake, normalizedFields) {
  return [
    stripIntakePrefix(rawIntake.title),
    normalizedFields.shortDescription,
    normalizedFields.desiredOutcome,
    normalizedFields.context,
    ...Object.values(normalizedFields.extraSections),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreLanguage(sample, markers) {
  return markers.reduce((score, marker) => score + (sample.includes(marker) ? 1 : 0), 0);
}

function inferOutputLanguage(rawIntake, normalizedFields) {
  const sample = ` ${buildLanguageSample(rawIntake, normalizedFields)} `;

  if (/[\u00c0-\u017f]/.test(sample) || /[¿¡ñ]/.test(sample)) {
    return OUTPUT_LANGUAGES.spanish;
  }

  const spanishScore = scoreLanguage(sample, LANGUAGE_DETECTION.spanish);
  const englishScore = scoreLanguage(sample, LANGUAGE_DETECTION.english);

  if (spanishScore > englishScore) {
    return OUTPUT_LANGUAGES.spanish;
  }

  return OUTPUT_LANGUAGES.english;
}

function buildModelPayload(issue, rawIntake) {
  const sections = parseFormSections(rawIntake.body);
  const normalizedFields = normalizeFormSections(sections);
  const selectedOutputLanguage = normalizedFields.outputLanguage;
  const resolvedOutputLanguage =
    selectedOutputLanguage === OUTPUT_LANGUAGES.auto
      ? inferOutputLanguage(rawIntake, normalizedFields)
      : selectedOutputLanguage;

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
    outputLanguage: {
      selected: selectedOutputLanguage,
      resolved: resolvedOutputLanguage,
    },
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

function formatLabelValue(value, language, kind) {
  return LANGUAGE_COPY[language][kind][value] ?? value;
}

function buildIssueBody(rawIntake, enrichment, language) {
  const copy = LANGUAGE_COPY[language] ?? LANGUAGE_COPY.english;
  const rawBody = rawIntake.body.trim() || copy.noOriginalBody;

  return [
    MANAGED_MARKER,
    copy.snapshotHeading,
    copy.tableHeader,
    "| --- | --- |",
    `| ${copy.typeLabel} | ${formatLabelValue(enrichment.type, language, "typeValues")} |`,
    `| ${copy.priorityLabel} | ${formatLabelValue(enrichment.priority, language, "priorityValues")} |`,
    "",
    copy.summaryHeading,
    enrichment.summary,
    "",
    copy.problemHeading,
    enrichment.problem,
    "",
    copy.desiredOutcomeHeading,
    enrichment.desiredOutcome,
    "",
    copy.acceptanceHeading,
    formatChecklist(enrichment.acceptanceCriteria, copy.acceptanceFallback),
    "",
    copy.notesHeading,
    copy.caveatsHeading,
    formatBulletList(enrichment.caveats, copy.caveatsFallback),
    "",
    copy.openQuestionsHeading,
    formatBulletList(enrichment.openQuestions, copy.openQuestionsFallback),
    "",
    copy.originalIntakeHeading,
    RAW_TITLE_START_MARKER,
    rawIntake.title,
    RAW_TITLE_END_MARKER,
    `**${copy.originalTitleLabel}:** ${rawIntake.title}`,
    "",
    RAW_START_MARKER,
    rawBody,
    RAW_END_MARKER,
    "",
    "---",
    copy.footer,
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
  const nextBody = buildIssueBody(rawIntake, enrichment, modelPayload.outputLanguage.resolved);
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
