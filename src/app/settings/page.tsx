import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const tNav = await getTranslations("nav");
  const tSettings = await getTranslations("settingsPage");

  return (
    <div className="px-12 md:px-20 pt-8 pb-24">
      <div className="max-w-2xl rounded-[var(--radius-xl)] border border-line bg-surface p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: "32px" }}>
            settings
          </span>
          <h1 className="text-3xl font-bold text-text font-headline">{tNav("settings")}</h1>
        </div>

        <div className="space-y-3 text-on-surface-variant">
          <p className="text-lg font-medium text-on-surface">{tSettings("title")}</p>
          <p>{tSettings("description")}</p>
        </div>
      </div>
    </div>
  );
}
