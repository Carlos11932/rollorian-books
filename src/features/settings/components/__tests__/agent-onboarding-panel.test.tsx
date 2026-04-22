import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      "agents.onboarding.title": "Onboarding por proveedor",
      "agents.onboarding.description": "Descripción onboarding",
      "agents.onboarding.baseUrlLabel": "Base URL detectada",
      "agents.onboarding.repoPathLabel": "Ruta local a sustituir",
      "agents.onboarding.repoPathHelp": "Sustituye esta ruta por la real.",
      "agents.onboarding.liveToken": "Incluye el último token.",
      "agents.onboarding.placeholderToken": "Usa <TOKEN>.",
      "agents.onboarding.copy": "Copiar",
      "agents.onboarding.copied": "Copiado",
      "agents.onboarding.snippetLabel.command": "Comando listo para pegar",
      "agents.onboarding.snippetLabel.json": "Configuración JSON",
      "agents.onboarding.snippetLabel.env": "Variables comunes",
      "agents.onboarding.snippetLabel.curl": "Smoke test de la Agent API",
      "agents.onboarding.provider.codex.title": "Codex",
      "agents.onboarding.provider.codex.description": "Registra el MCP desde Codex.",
      "agents.onboarding.provider.claude.title": "Claude Code",
      "agents.onboarding.provider.claude.description": "Registra el MCP desde Claude Code.",
      "agents.onboarding.provider.cursor.title": "Cursor",
      "agents.onboarding.provider.cursor.description": "Pega este bloque en Cursor.",
      "agents.onboarding.provider.generic.title": "Cliente MCP genérico",
      "agents.onboarding.provider.generic.description": "Usa una plantilla genérica.",
    };

    return translations[key] ?? key;
  },
}));

vi.mock("@/features/shared/components/button", () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

import { AgentOnboardingPanel } from "../agent-onboarding-panel";

describe("AgentOnboardingPanel", () => {
  it("renders the default Codex onboarding with detected values", () => {
    const html = renderToStaticMarkup(
      <AgentOnboardingPanel
        baseUrl="https://rollorian-books.vercel.app"
        token="rla_live_token"
        repoRootPlaceholder="/absolute/path/to/rollorian-books"
        serverName="rollorian-books"
      />,
    );

    expect(html).toContain("Onboarding por proveedor");
    expect(html).toContain("https://rollorian-books.vercel.app");
    expect(html).toContain("/absolute/path/to/rollorian-books");
    expect(html).toContain("codex mcp add rollorian-books");
    expect(html).toContain("ROLLORIAN_AGENT_TOKEN=rla_live_token");
  });
});
