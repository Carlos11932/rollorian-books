import "server-only";

import { Resend } from "resend";
import { InvitationEmail } from "./invitation-email";

// Lazy singleton — avoids "Missing API key" crash at build time
// when RESEND_API_KEY is not in the build environment (e.g., Vercel previews).
// Reuses the same instance across calls instead of creating one per invocation.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not configured");
    _resend = new Resend(key);
  }
  return _resend;
}

// Deferred to call time — VERCEL_URL is only available at runtime, not during build.
function getAppUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://rollorian-books.vercel.app")
  );
}

export async function sendInvitationEmail(to: string): Promise<void> {
  const { error } = await getResend().emails.send({
    from: "onboarding@resend.dev",
    to,
    subject: "Te han invitado a Rollorian Books",
    react: InvitationEmail({ appUrl: getAppUrl() }),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
