'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { UserRole } from '@/lib/types/user';

interface MobileNavProps {
  role?: UserRole;
  pendingGroupInvitations?: number;
}

export function MobileNav({ role, pendingGroupInvitations = 0 }: MobileNavProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const staticMobileNavItems = [
    { href: '/', key: 'home', icon: 'home' },
    { href: '/search', key: 'search', icon: 'search' },
    { href: '/library', key: 'library', icon: 'local_library' },
    { href: '/groups', key: 'groups', icon: 'group' },
  ] as const;

  const mobileNavItems = [
    ...staticMobileNavItems,
    ...(role === 'SUPERADMIN'
      ? [{ href: '/admin' as const, key: 'admin' as const, icon: 'admin_panel_settings' as const }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-2xl md:hidden z-50 flex justify-around items-center py-4 px-6 border-t border-outline-variant/10">
      {mobileNavItems.map(({ href, key, icon }) => {
        const isActive = pathname === href;
        const isGroups = href === '/groups';
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 transition-colors relative',
              isActive ? 'text-primary' : 'text-tertiary'
            )}
          >
            <span className="relative inline-block">
              <span className="material-symbols-outlined text-[24px]">{icon}</span>
              {isGroups && pendingGroupInvitations > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-error text-on-error text-[10px] font-bold rounded-full px-1 leading-none">
                  {pendingGroupInvitations > 99 ? '99+' : pendingGroupInvitations}
                </span>
              )}
            </span>
            {isActive && (
              <span className="w-1 h-1 bg-secondary rounded-full" aria-hidden="true" />
            )}
            <span className="sr-only">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
