import { getTranslations } from "next-intl/server";
import { AgentSettingsPanel } from "@/features/settings/components/agent-settings-panel";
import { requireAuth } from "@/lib/auth/require-auth";
import { listAgentClientsForUser, listRecentAgentAuditEventsForUser } from "@/lib/agents";

export default async function SettingsPage() {
  const tNav = await getTranslations("nav");
  const tSettings = await getTranslations("settingsPage");
  const { userId } = await requireAuth();
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
      />
    </div>
  );
}
