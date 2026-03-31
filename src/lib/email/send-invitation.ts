import "server-only";

import { Resend } from "resend";
import { InvitationEmail } from "./invitation-email";

// Lazy instantiation — avoids "Missing API key" crash at build time
// when RESEND_API_KEY is not in the build environment (e.g., Vercel previews).
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(key);
}

const APP_URL =
  process.env.NEXTAUTH_URL || "https://rollorian-books.vercel.app";

export async function sendInvitationEmail(to: string): Promise<void> {
  const { error } = await getResend().emails.send({
    from: "onboarding@resend.dev",
    to,
    subject: "Te han invitado a Rollorian Books",
    react: InvitationEmail({ appUrl: APP_URL }),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
