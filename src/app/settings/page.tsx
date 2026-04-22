import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { AgentSettingsPanel } from "@/features/settings/components/agent-settings-panel";
import { requireAuth } from "@/lib/auth/require-auth";
import { listAgentClientsForUser, listRecentAgentAuditEventsForUser } from "@/lib/agents";
import { env } from "@/lib/env";

function resolveBaseUrl({
  headerHost,
  headerProtocol,
}: {
  headerHost: string | null;
  headerProtocol: string | null;
}): string {
  if (env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL;
  }

  if (headerHost) {
    return `${headerProtocol ?? "https"}://${headerHost}`;
  }

  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  return "https://your-rollorian.vercel.app";
}

export default async function SettingsPage() {
  const headersList = await headers();
  const tNav = await getTranslations("nav");
  const tSettings = await getTranslations("settingsPage");
  const { userId } = await requireAuth();
  const baseUrl = resolveBaseUrl({
    headerHost: headersList.get("x-forwarded-host") ?? headersList.get("host"),
    headerProtocol: headersList.get("x-forwarded-proto"),
  });
  const [clients, recentEvents] = await Promise.all([
    listAgentClientsForUser(userId),
    listRecentAgentAuditEventsForUser(userId),
  ]);

  return (
    <div className="px-12 md:px-20 pt-8 pb-24 grid gap-6">
      <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[32px]">
            settings
          </span>
          <h1 className="text-3xl font-bold text-text font-headline">{tNav("settings")}</h1>
        </div>

        <div className="space-y-3 text-on-surface-variant max-w-3xl">
          <p className="text-lg font-medium text-on-surface">{tSettings("title")}</p>
          <p>{tSettings("description")}</p>
        </div>
      </div>

      <AgentSettingsPanel
        initialClients={clients}
        initialRecentEvents={recentEvents}
        baseUrl={baseUrl}
      />
    </div>
  );
}
