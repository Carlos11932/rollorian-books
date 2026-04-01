import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { InviteForm } from "@/features/admin/components/invite-form";
import { InvitationList } from "@/features/admin/components/invitation-list";
import { UserList } from "@/features/admin/components/user-list";

export default async function AdminPage() {
  const t = await getTranslations("admin");
  const { userId: currentUserId } = await requireSuperAdmin();

  const [invitations, users] = await Promise.all([
    prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        invitedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        _count: { select: { userBooks: true } },
      },
    }),
  ]);

  const usersWithStats = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: u.role as "USER" | "SUPERADMIN",
    bookCount: u._count.userBooks,
  }));

  const serializedInvitations = invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    status: inv.status as "PENDING" | "ACCEPTED" | "EXPIRED",
    createdAt: inv.createdAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
    invitedBy: inv.invitedBy,
  }));

  return (
    <div className="grid gap-6 px-12 md:px-20 pt-8 pb-24">
      {/* Page header */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-1"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{t('heading')}</p>
        <h1 className="text-3xl font-bold text-text" style={{ fontFamily: "var(--font-headline)" }}>
          {t("heading")}
        </h1>
        <p className="text-sm text-muted leading-relaxed max-w-lg">
          {t("description")}
        </p>
      </div>

      {/* Invite User section */}
      <section
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-4"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <h2 className="text-lg font-semibold text-on-surface">{t("inviteSectionTitle")}</h2>
        <InviteForm />
      </section>

      {/* Pending Invitations section */}
      <section
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-4"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <h2 className="text-lg font-semibold text-on-surface">{t("invitationsSectionTitle")}</h2>
        <InvitationList invitations={serializedInvitations} />
      </section>

      {/* Users section */}
      <section
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-4"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <h2 className="text-lg font-semibold text-on-surface">{t("usersSectionTitle")}</h2>
        <UserList users={usersWithStats} currentUserId={currentUserId} />
      </section>
    </div>
  );
}
