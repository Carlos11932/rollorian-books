"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/features/shared/components/button";
import { AgentOnboardingPanel } from "./agent-onboarding-panel";
import {
  AGENT_CLIENT_KINDS,
  AGENT_SCOPES,
  type AgentScope,
} from "@/lib/agents/constants";
import {
  createAgentConnection,
  issueAgentCredential,
  revokeAgentClient,
  revokeAgentCredential,
} from "@/lib/api/agents";
import type { AgentAuditEventSummary, AgentClientSummary } from "@/lib/agents/types";

function formatDate(value: string | null, emptyLabel: string): string {
  if (!value) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClasses(status: "ACTIVE" | "REVOKED" | "SUCCESS" | "FAILURE" | "REJECTED"): string {
  switch (status) {
    case "ACTIVE":
    case "SUCCESS":
      return "bg-emerald-500/15 text-emerald-200 border border-emerald-400/20";
    case "FAILURE":
      return "bg-rose-500/15 text-rose-200 border border-rose-400/20";
    case "REJECTED":
    case "REVOKED":
      return "bg-amber-500/15 text-amber-200 border border-amber-400/20";
    default:
      return "bg-white/10 text-text border border-line";
  }
}

interface AgentSettingsPanelProps {
  initialClients: AgentClientSummary[];
  initialRecentEvents: AgentAuditEventSummary[];
  baseUrl: string;
}

export function AgentSettingsPanel({
  initialClients,
  initialRecentEvents,
  baseUrl,
}: AgentSettingsPanelProps) {
  const t = useTranslations("settingsPage");
  const [clients, setClients] = useState(initialClients);
  const [recentEvents, setRecentEvents] = useState(initialRecentEvents);
  const [connectionName, setConnectionName] = useState("");
  const [connectionKind, setConnectionKind] = useState<(typeof AGENT_CLIENT_KINDS)[number]>("PRIVATE_COMPANION");
  const [selectedScopes, setSelectedScopes] = useState<AgentScope[]>([
    "profile:read",
    "summary:read",
    "library:read",
    "books:resolve",
    "reading-events:write",
  ]);
  const [isSaving, startSaving] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestToken, setLatestToken] = useState<{ label: string; token: string } | null>(null);

  function updateClient(nextClient: AgentClientSummary) {
    setClients((current) => {
      const hasExisting = current.some((client) => client.id === nextClient.id);
      if (!hasExisting) {
        return [nextClient, ...current];
      }

      return current.map((client) => client.id === nextClient.id ? nextClient : client);
    });
  }

  function toggleScope(scope: AgentScope) {
    setSelectedScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope]);
  }

  function resetCreateForm() {
    setConnectionName("");
    setConnectionKind("PRIVATE_COMPANION");
    setSelectedScopes([
      "profile:read",
      "summary:read",
      "library:read",
      "books:resolve",
      "reading-events:write",
    ]);
  }

  function handleCreateConnection() {
    if (!connectionName.trim() || selectedScopes.length === 0) {
      return;
    }

    setError(null);
    startSaving(async () => {
      try {
        const result = await createAgentConnection({
          name: connectionName.trim(),
          kind: connectionKind,
          scopes: selectedScopes,
        });

        updateClient(result.client);
        setRecentEvents(result.recentEvents);
        setLatestToken({ label: result.client.name, token: result.plainToken ?? "" });
        resetCreateForm();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("errors.generic"));
      }
    });
  }

  async function handleIssueCredential(client: AgentClientSummary) {
    setBusyKey(`issue:${client.id}`);
    setError(null);

    try {
      const result = await issueAgentCredential(client.id, {
        scopes: client.credentials[0]?.scopes ?? ["profile:read"],
      });

      updateClient(result.client);
      setRecentEvents(result.recentEvents);
      setLatestToken({ label: client.name, token: result.plainToken ?? "" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.generic"));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRevokeClient(client: AgentClientSummary) {
    setBusyKey(`client:${client.id}`);
    setError(null);

    try {
      const result = await revokeAgentClient(client.id);
      updateClient(result.client);
      setRecentEvents(result.recentEvents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.generic"));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRevokeCredential(clientId: string, credentialId: string) {
    setBusyKey(`credential:${credentialId}`);
    setError(null);

    try {
      const result = await revokeAgentCredential(clientId, credentialId);
      updateClient(result.client);
      setRecentEvents(result.recentEvents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.generic"));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="card-glass backdrop-blur-xl p-6 grid gap-5">
          <div className="grid gap-1">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted">
              {t("agents.eyebrow")}
            </p>
            <h2 className="text-2xl font-bold text-text font-headline">{t("agents.title")}</h2>
            <p className="text-sm text-muted max-w-2xl">{t("agents.description")}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[var(--radius-lg)] border border-line bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{t("agents.cards.apiTitle")}</p>
              <p className="mt-2 text-sm text-on-surface-variant">{t("agents.cards.apiBody")}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-line bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{t("agents.cards.privateMcpTitle")}</p>
              <p className="mt-2 text-sm text-on-surface-variant">{t("agents.cards.privateMcpBody")}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-line bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{t("agents.cards.publicMcpTitle")}</p>
              <p className="mt-2 text-sm text-on-surface-variant">{t("agents.cards.publicMcpBody")}</p>
            </div>
          </div>

          <div className="grid gap-4 rounded-[var(--radius-lg)] border border-line bg-surface-soft p-5">
            <div className="grid gap-1">
              <h3 className="text-lg font-semibold text-on-surface">{t("agents.create.title")}</h3>
              <p className="text-sm text-muted">{t("agents.create.description")}</p>
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("agents.create.nameLabel")}
              </span>
              <input
                type="text"
                value={connectionName}
                onChange={(event) => setConnectionName(event.target.value)}
                placeholder={t("agents.create.namePlaceholder")}
                className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/50"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("agents.create.kindLabel")}
              </span>
              <select
                value={connectionKind}
                onChange={(event) => setConnectionKind(event.target.value as (typeof AGENT_CLIENT_KINDS)[number])}
                className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/50"
              >
                {AGENT_CLIENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`agents.kind.${kind}`)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("agents.create.scopesLabel")}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {AGENT_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="mt-1"
                    />
                    <span className="grid gap-1">
                      <span className="text-sm font-semibold text-on-surface">
                        {t(`agents.scopeTitle.${scope}`)}
                      </span>
                      <span className="text-xs text-muted">
                        {t(`agents.scopeDescription.${scope}`)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-error">{error}</p>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleCreateConnection}
                loading={isSaving}
                disabled={!connectionName.trim() || selectedScopes.length === 0}
              >
                {t("agents.create.submit")}
              </Button>
            </div>
          </div>
        </section>

        <section className="card-glass backdrop-blur-xl p-6 grid gap-4">
          <div className="grid gap-1">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted">
              {t("agents.token.eyebrow")}
            </p>
            <h2 className="text-xl font-bold text-text font-headline">{t("agents.token.title")}</h2>
            <p className="text-sm text-muted">{t("agents.token.description")}</p>
          </div>

          {latestToken ? (
            <div className="grid gap-3 rounded-[var(--radius-lg)] border border-accent/30 bg-accent/10 p-4">
              <div>
                <p className="text-sm font-semibold text-on-surface">{latestToken.label}</p>
                <p className="text-xs text-muted">{t("agents.token.warning")}</p>
              </div>
              <pre className="overflow-x-auto rounded-[var(--radius-sm)] bg-black/30 px-3 py-3 text-sm text-white">
                <code>{latestToken.token}</code>
              </pre>
            </div>
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-line px-4 py-6 text-sm text-muted">
              {t("agents.token.empty")}
            </div>
          )}

          <AgentOnboardingPanel
            baseUrl={baseUrl}
            token={latestToken?.token ?? null}
            repoRootPlaceholder="/absolute/path/to/rollorian-books"
            serverName="rollorian-books"
          />
        </section>
      </div>

      <section className="card-glass backdrop-blur-xl p-6 grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <h2 className="text-2xl font-bold text-text font-headline">{t("agents.connections.title")}</h2>
            <p className="text-sm text-muted">{t("agents.connections.description")}</p>
          </div>
          <div className="rounded-full border border-line bg-white/5 px-4 py-2 text-sm text-muted">
            {t("agents.connections.count", { count: clients.length })}
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-line px-5 py-8 text-sm text-muted">
            {t("agents.connections.empty")}
          </div>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <article key={client.id} className="grid gap-4 rounded-[var(--radius-lg)] border border-line bg-surface-soft p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-on-surface">{client.name}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(client.status)}`}>
                        {t(`agents.status.${client.status}`)}
                      </span>
                      <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                        {t(`agents.kind.${client.kind}`)}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {t("agents.connections.lastUsed", { date: formatDate(client.lastUsedAt, t("agents.connections.never")) })}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={busyKey === `issue:${client.id}`}
                      disabled={client.status !== "ACTIVE"}
                      onClick={() => void handleIssueCredential(client)}
                    >
                      {t("agents.connections.newToken")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={busyKey === `client:${client.id}`}
                      disabled={client.status !== "ACTIVE"}
                      onClick={() => void handleRevokeClient(client)}
                    >
                      {t("agents.connections.revokeConnection")}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {client.credentials[0]?.scopes.map((scope) => (
                    <span key={`${client.id}:${scope}`} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-on-surface-variant">
                      {t(`agents.scopeTitle.${scope}`)}
                    </span>
                  ))}
                </div>

                <div className="grid gap-3">
                  <p className="text-sm font-semibold text-on-surface">{t("agents.connections.credentials")}</p>
                  {client.credentials.map((credential) => (
                    <div key={credential.id} className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="grid gap-1 text-sm">
                        <p className="font-mono text-on-surface">{credential.tokenPrefix}</p>
                        <p className="text-muted">
                          {t("agents.connections.credentialMeta", {
                            createdAt: formatDate(credential.createdAt, t("agents.connections.never")),
                            lastUsedAt: formatDate(credential.lastUsedAt, t("agents.connections.never")),
                          })}
                        </p>
                        {credential.revokedAt && (
                          <p className="text-xs text-amber-300">
                            {t("agents.connections.revokedAt", { date: formatDate(credential.revokedAt, t("agents.connections.never")) })}
                          </p>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={busyKey === `credential:${credential.id}`}
                        disabled={credential.revokedAt != null || client.status !== "ACTIVE"}
                        onClick={() => void handleRevokeCredential(client.id, credential.id)}
                      >
                        {credential.revokedAt ? t("agents.connections.revoked") : t("agents.connections.revokeToken")}
                      </Button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card-glass backdrop-blur-xl p-6 grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold text-text font-headline">{t("agents.activity.title")}</h2>
          <p className="text-sm text-muted">{t("agents.activity.description")}</p>
        </div>

        {recentEvents.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-line px-5 py-8 text-sm text-muted">
            {t("agents.activity.empty")}
          </div>
        ) : (
          <div className="grid gap-2">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="grid gap-2 rounded-[var(--radius-md)] border border-line bg-surface-soft px-4 py-3 md:grid-cols-[auto_1fr_auto]"
              >
                <span className={`inline-flex h-fit rounded-full px-3 py-1 text-xs font-medium ${statusClasses(event.outcome)}`}>
                  {t(`agents.outcome.${event.outcome}`)}
                </span>
                <div className="grid gap-1 text-sm">
                  <p className="font-medium text-on-surface">{event.action}</p>
                  <p className="text-muted">
                    {event.resourceType ?? t("agents.activity.genericResource")}
                    {event.resourceId ? ` | ${event.resourceId}` : ""}
                    {event.idempotencyKey ? ` | ${event.idempotencyKey}` : ""}
                  </p>
                </div>
                <p className="text-sm text-muted">{formatDate(event.createdAt, t("agents.connections.never"))}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
