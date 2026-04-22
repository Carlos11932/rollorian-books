"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/features/shared/components/button";
import {
  AGENT_ONBOARDING_PROVIDERS,
  buildAgentOnboardingSnippets,
  type AgentOnboardingProvider,
} from "@/lib/agents/onboarding";

interface AgentOnboardingPanelProps {
  baseUrl: string;
  token: string | null;
  repoRootPlaceholder: string;
  serverName: string;
}

interface CodeBlockProps {
  label: string;
  code: string;
  copyLabel: string;
  copiedLabel: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => Promise<void>;
}

function CodeBlock({
  label,
  code,
  copyLabel,
  copiedLabel,
  copyKey,
  copiedKey,
  onCopy,
}: CodeBlockProps) {
  return (
    <div className="grid gap-2 rounded-[var(--radius-lg)] border border-line bg-surface-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void onCopy(copyKey, code)}
        >
          {copiedKey === copyKey ? copiedLabel : copyLabel}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-[var(--radius-sm)] bg-black/30 px-3 py-3 text-xs text-white">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function AgentOnboardingPanel({
  baseUrl,
  token,
  repoRootPlaceholder,
  serverName,
}: AgentOnboardingPanelProps) {
  const t = useTranslations("settingsPage");
  const [selectedProvider, setSelectedProvider] = useState<AgentOnboardingProvider>("codex");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const snippets = useMemo(() => buildAgentOnboardingSnippets({
    baseUrl,
    token,
    repoRootPlaceholder,
    serverName,
  }), [baseUrl, token, repoRootPlaceholder, serverName]);

  const defaultSnippet = snippets[0];
  if (!defaultSnippet) {
    return null;
  }

  const currentSnippet = snippets.find((entry) => entry.provider === selectedProvider) ?? defaultSnippet;
  const hasLiveToken = Boolean(token?.trim());

  async function handleCopy(key: string, value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => current === key ? null : current);
    }, 2000);
  }

  return (
    <div className="grid gap-4 rounded-[var(--radius-lg)] border border-line bg-surface-soft p-5">
      <div className="grid gap-1">
        <h3 className="text-lg font-semibold text-on-surface">{t("agents.onboarding.title")}</h3>
        <p className="text-sm text-muted">{t("agents.onboarding.description")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 text-sm text-on-surface-variant">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("agents.onboarding.baseUrlLabel")}
          </p>
          <p className="mt-2 font-mono text-xs text-on-surface">{baseUrl}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 text-sm text-on-surface-variant">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("agents.onboarding.repoPathLabel")}
          </p>
          <p className="mt-2 font-mono text-xs text-on-surface">{repoRootPlaceholder}</p>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-dashed border-line px-4 py-3 text-sm text-muted">
        {t("agents.onboarding.repoPathHelp")}
      </div>

      <div className="flex flex-wrap gap-2">
        {AGENT_ONBOARDING_PROVIDERS.map((provider) => {
          const isActive = provider === selectedProvider;
          return (
            <button
              key={provider}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSelectedProvider(provider)}
              className={[
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-accent/40 bg-accent/15 text-on-surface"
                  : "border-line bg-surface text-muted hover:text-on-surface",
              ].join(" ")}
            >
              {t(`agents.onboarding.provider.${provider}.title`)}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-4">
        <div className="grid gap-1">
          <p className="text-base font-semibold text-on-surface">
            {t(`agents.onboarding.provider.${selectedProvider}.title`)}
          </p>
          <p className="text-sm text-muted">
            {t(`agents.onboarding.provider.${selectedProvider}.description`)}
          </p>
        </div>

        <p className={`text-xs ${hasLiveToken ? "text-emerald-300" : "text-amber-300"}`}>
          {hasLiveToken ? t("agents.onboarding.liveToken") : t("agents.onboarding.placeholderToken")}
        </p>

        <CodeBlock
          label={t(`agents.onboarding.snippetLabel.${currentSnippet.primaryLabel}`)}
          code={currentSnippet.primarySnippet}
          copyLabel={t("agents.onboarding.copy")}
          copiedLabel={t("agents.onboarding.copied")}
          copyKey={`${selectedProvider}:primary`}
          copiedKey={copiedKey}
          onCopy={handleCopy}
        />

        {currentSnippet.secondarySnippet && currentSnippet.secondaryLabel ? (
          <CodeBlock
            label={t(`agents.onboarding.snippetLabel.${currentSnippet.secondaryLabel}`)}
            code={currentSnippet.secondarySnippet}
            copyLabel={t("agents.onboarding.copy")}
            copiedLabel={t("agents.onboarding.copied")}
            copyKey={`${selectedProvider}:secondary`}
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />
        ) : null}
      </div>
    </div>
  );
}
