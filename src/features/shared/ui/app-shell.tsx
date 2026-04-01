import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth, signOut } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isPrismaSchemaMismatchError } from '@/lib/prisma-schema-compat';
import { SiteHeader } from './site-header';
import { NavLinks } from './nav-links';
import { MobileNav } from './mobile-nav';

interface AppShellProps {
  children: React.ReactNode;
}

export async function AppShell({ children }: AppShellProps) {
  const t = await getTranslations('nav');
  const session = await auth();

  // Session is guaranteed here — middleware protects all routes.
  // Fallback values are for type safety only.
  const user = {
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? "",
    image: session?.user?.image ?? null,
    role: session?.user?.role ?? "USER",
  };

  // Fetch pending group invitation count for nav badge
  let pendingGroupInvitations = 0;
  if (session?.user?.id) {
    try {
      pendingGroupInvitations = await prisma.groupMember.count({
        where: { userId: session.user.id, status: 'PENDING' },
      });
    } catch (error) {
      if (!isPrismaSchemaMismatchError(error)) {
        throw error;
      }
    }
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <>
      {/* Fixed top nav */}
      <SiteHeader user={user} signOutAction={signOutAction} role={user.role} />

      {/* Fixed sidebar — desktop only */}
      <aside className="fixed left-0 top-0 h-full w-64 hidden lg:flex flex-col py-8 z-40 bg-surface-container-lowest shadow-[40px_0_40px_rgba(0,17,12,0.4)]">
        {/* Sidebar header */}
        <div className="px-6 mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">auto_stories</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-primary font-headline tracking-tighter">
                {t('appName')}
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-tertiary/60">
                {t('tagline')}
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar nav links */}
        <NavLinks role={user.role} pendingGroupInvitations={pendingGroupInvitations} />

        {/* Sidebar footer */}
        <div className="px-6 flex flex-col gap-4">
          <div className="pt-4 flex flex-col gap-2 border-t border-outline-variant/10">
            <Link
              href="/settings"
              className="flex items-center gap-3 text-tertiary py-2 hover:text-primary text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
              {t('settings')}
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64 pt-16 min-h-screen">{children}</main>

      {/* Mobile bottom nav */}
      <MobileNav role={user.role} pendingGroupInvitations={pendingGroupInvitations} />
    </>
  );
}
