import "server-only";

import { Resend } from "resend";
import { InvitationEmail } from "./invitation-email";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL =
  process.env.NEXTAUTH_URL || "https://rollorian-books.vercel.app";

export async function sendInvitationEmail(to: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to,
    subject: "Te han invitado a Rollorian Books",
    react: InvitationEmail({ appUrl: APP_URL }),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
