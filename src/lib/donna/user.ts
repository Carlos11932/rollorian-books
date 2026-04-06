import "server-only";

import { prisma } from "@/lib/prisma";

export class DonnaUserNotConfiguredError extends Error {
  constructor(message = "DONNA_USER_EMAIL or SUPERADMIN_EMAIL must be configured") {
    super(message);
    this.name = "DonnaUserNotConfiguredError";
  }
}

export class DonnaUserNotFoundError extends Error {
  constructor(email: string) {
    super(`Donna user not found for ${email}`);
    this.name = "DonnaUserNotFoundError";
  }
}

export async function getDonnaUserContext(): Promise<{
  userId: string;
  email: string;
  name: string | null;
}> {
  const email = process.env.DONNA_USER_EMAIL ?? process.env.SUPERADMIN_EMAIL;

  if (!email) {
    throw new DonnaUserNotConfiguredError();
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    throw new DonnaUserNotFoundError(email);
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
  };
}
